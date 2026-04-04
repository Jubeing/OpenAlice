import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type EventLogEntry, type CronJob, type CronSchedule } from '../api'
import { useSSE } from '../hooks/useSSE'
import { Toggle } from '../components/Toggle'
import { PageHeader } from '../components/PageHeader'
import { useTranslation, type Translations } from '../i18n'

// ==================== Helpers ====================

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour12: false })
  return `${date} ${time}`
}

function timeAgo(ts: number | null): string {
  if (!ts) return '-'
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function scheduleLabel(s: CronSchedule, eventsT: Translations['events']): string {
  switch (s.kind) {
    case 'at': return `at ${s.at}`
    case 'every': return `${eventsT.every} ${s.every}`
    case 'cron': return `cron: ${s.cron}`
  }
}

function eventTypeColor(type: string): string {
  if (type.startsWith('heartbeat.')) return 'text-purple'
  if (type.startsWith('cron.')) return 'text-accent'
  if (type.startsWith('message.')) return 'text-green'
  return 'text-text-muted'
}

// ==================== EventLog Section ====================

const PAGE_SIZE = 100

function EventLogSection() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [paused, setPaused] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (p: number, type?: string) => {
    setLoading(true)
    try {
      const result = await api.events.query({ page: p, pageSize: PAGE_SIZE, type: type || undefined })
      setEntries(result.entries)
      setPage(result.page)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (err) {
      console.warn('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPage(1) }, [fetchPage])

  useEffect(() => {
    if (entries.length > 0) {
      setTypes((prev) => {
        const next = new Set(prev)
        for (const e of entries) next.add(e.type)
        return [...next].sort()
      })
    }
  }, [entries])

  useSSE({
    url: '/api/events/stream',
    onMessage: (entry: EventLogEntry) => {
      setTypes((prev) => {
        if (prev.includes(entry.type)) return prev
        return [...prev, entry.type].sort()
      })
      setTotal((prev) => prev + 1)
      if (page === 1) {
        const matchesFilter = !typeFilter || entry.type === typeFilter
        if (matchesFilter) setEntries((prev) => [entry, ...prev].slice(0, PAGE_SIZE))
      }
    },
    enabled: !paused,
  })

  const handleTypeChange = useCallback((type: string) => {
    setTypeFilter(type)
    fetchPage(1, type)
  }, [fetchPage])

  const goToPage = useCallback((p: number) => {
    fetchPage(p, typeFilter || undefined)
    containerRef.current?.scrollTo(0, 0)
  }, [fetchPage, typeFilter])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="bg-bg-tertiary text-text text-sm rounded-md border border-border px-2 py-1.5 outline-none focus:border-accent"
        >
          <option value="">{t.events.allTypes}</option>
          {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
        </select>

        <button
          onClick={() => setPaused(!paused)}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            paused ? 'border-notification-border text-notification-border hover:bg-notification-bg' : 'border-border text-text-muted hover:bg-bg-tertiary'
          }`}
        >
          {paused ? `▶ ${t.events.resume}` : `⏸ ${t.events.pause}`}
        </button>

        <span className="text-xs text-text-muted ml-auto">
          {total > 0
            ? `Page ${page} of ${totalPages} · ${total} ${t.events.events}`
            : `0 ${t.events.events}`
          }
          {typeFilter && ` ${t.events.filtered}`}
        </span>
      </div>

      {/* Event list */}
      <div ref={containerRef} className="flex-1 min-h-0 bg-bg rounded-lg border border-border overflow-y-auto font-mono text-xs">
        {loading && entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted">{t.events.loading}</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted">{t.events.noEvents}</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-bg-secondary">
              <tr className="text-text-muted text-left">
                <th className="px-3 py-2 w-12">#</th>
                <th className="px-3 py-2 w-36">{t.agentStatus.time}</th>
                <th className="px-3 py-2 w-40">{t.events.type}</th>
                <th className="px-3 py-2">{t.events.payload}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => <EventRow key={entry.seq} entry={entry} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button onClick={() => goToPage(1)} disabled={page <= 1 || loading} className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">««</button>
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading} className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">«</button>
          <span className="text-xs text-text-muted px-2">{page} / {totalPages}</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages || loading} className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">»</button>
          <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages || loading} className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">»»</button>
        </div>
      )}
    </div>
  )
}

function EventRow({ entry }: { entry: EventLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const payloadStr = JSON.stringify(entry.payload)
  const isLong = payloadStr.length > 120

  return (
    <>
      <tr
        className="border-t border-border/50 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
        onClick={() => isLong && setExpanded(!expanded)}
      >
        <td className="px-3 py-1.5 text-text-muted">{entry.seq}</td>
        <td className="px-3 py-1.5 text-text-muted whitespace-nowrap">{formatDateTime(entry.ts)}</td>
        <td className={`px-3 py-1.5 ${eventTypeColor(entry.type)}`}>{entry.type}</td>
        <td className="px-3 py-1.5 text-text-muted truncate">
          {isLong ? payloadStr.slice(0, 120) + '...' : payloadStr}
          {isLong && <span className="ml-1 text-accent">{expanded ? '▾' : '▸'}</span>}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border/30">
          <td colSpan={4} className="px-3 py-2">
            <pre className="text-text-muted whitespace-pre-wrap break-all bg-bg-tertiary rounded p-2 text-[11px]">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ==================== Cron Section ====================

function CronSection() {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    try {
      const { jobs } = await api.cron.list()
      setJobs(jobs)
    } catch (err) {
      console.warn('Failed to load cron jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])
  useEffect(() => {
    const id = setInterval(loadJobs, 15_000)
    return () => clearInterval(id)
  }, [loadJobs])

  const showErrorMsg = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 3000)
  }

  const handleToggle = async (job: CronJob) => {
    try {
      await api.cron.update(job.id, { enabled: !job.enabled })
      await loadJobs()
    } catch { showErrorMsg(t.events.toggleFailed) }
  }

  const handleRunNow = async (job: CronJob) => {
    try { await api.cron.runNow(job.id); await loadJobs() } catch { showErrorMsg(t.events.runFailed) }
  }

  const handleDelete = async (job: CronJob) => {
    if (job.name === '__heartbeat__') return
    try { await api.cron.remove(job.id); await loadJobs() } catch { showErrorMsg(t.events.deleteFailed) }
  }

  if (loading) return <div className="text-text-muted text-sm py-4">{t.events.loading}</div>

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-xs text-red">{error}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{jobs.length} {t.events.jobs}</span>
        <button onClick={() => setShowAdd(true)} className="btn-secondary-sm">+ {t.events.addJob}</button>
      </div>

      {showAdd && (
        <AddCronJobForm onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); loadJobs() }} />
      )}

      {jobs.length === 0 ? (
        <div className="text-text-muted text-sm text-center py-6">{t.events.noCronJobs}</div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <CronJobCard key={job.id} job={job} onToggle={() => handleToggle(job)} onRunNow={() => handleRunNow(job)} onDelete={() => handleDelete(job)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CronJobCard({ job, onToggle, onRunNow, onDelete }: { job: CronJob; onToggle: () => void; onRunNow: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isHeartbeat = job.name === '__heartbeat__'

  return (
    <div className={`rounded-lg border ${job.enabled ? 'border-border' : 'border-border/50 opacity-60'} bg-bg`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle size="sm" checked={job.enabled} onChange={onToggle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isHeartbeat ? 'text-purple' : 'text-text'}`}>
              {isHeartbeat ? '💓 heartbeat' : job.name}
            </span>
            <span className="text-xs text-text-muted">{job.id}</span>
            {job.state.lastStatus === 'error' && (
              <span className="text-xs text-red">{job.state.consecutiveErrors}x err</span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {scheduleLabel(job.schedule, t.events)}
            {job.state.nextRunAtMs && <span className="ml-2">· {t.events.next}: {formatDateTime(job.state.nextRunAtMs)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onRunNow} title={t.events.runNow} className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-bg-tertiary transition-colors text-xs">▶</button>
          <button onClick={() => setExpanded(!expanded)} title="Details" className="p-1.5 rounded text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors text-xs">{expanded ? '▾' : '▸'}</button>
          {!isHeartbeat && <button onClick={onDelete} title={t.events.delete} className="p-1.5 rounded text-text-muted hover:text-red hover:bg-bg-tertiary transition-colors text-xs">✕</button>}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 text-xs space-y-2">
          <div>
            <span className="text-text-muted">{t.events.payloadLabel}: </span>
            <pre className="inline text-text whitespace-pre-wrap break-all">{job.payload}</pre>
          </div>
          <div className="flex gap-4 text-text-muted">
            <span>{t.events.lastRun}: {job.state.lastRunAtMs ? `${timeAgo(job.state.lastRunAtMs)} (${formatDateTime(job.state.lastRunAtMs)})` : t.events.never}</span>
            <span>{t.events.status}: {job.state.lastStatus ?? 'n/a'}</span>
            <span>{t.events.created}: {formatDateTime(job.createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCronJobForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [payload, setPayload] = useState('')
  const [schedKind, setSchedKind] = useState<'every' | 'cron' | 'at'>('every')
  const [schedValue, setSchedValue] = useState('1h')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !payload.trim()) { setError('Name and payload are required'); return }

    let schedule: CronSchedule
    if (schedKind === 'every') schedule = { kind: 'every', every: schedValue }
    else if (schedKind === 'cron') schedule = { kind: 'cron', cron: schedValue }
    else schedule = { kind: 'at', at: schedValue }

    setSaving(true)
    setError('')
    try {
      await api.cron.add({ name: name.trim(), payload: payload.trim(), schedule })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.events.createFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg rounded-lg border border-accent/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">{t.events.newCronJob}</span>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text text-xs">✕</button>
      </div>

      <input type="text" placeholder={t.events.jobName} value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent" />
      <textarea placeholder={t.events.payloadLabel} value={payload} onChange={(e) => setPayload(e.target.value)} rows={2} className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent resize-none" />

      <div className="flex gap-2">
        <select value={schedKind} onChange={(e) => { const k = e.target.value as 'every' | 'cron' | 'at'; setSchedKind(k); if (k === 'every') setSchedValue('1h'); else if (k === 'cron') setSchedValue('0 9 * * 1-5'); else setSchedValue(new Date(Date.now() + 3600_000).toISOString()) }} className="bg-bg-tertiary border border-border rounded-md px-2 py-2 text-sm text-text outline-none focus:border-accent">
          <option value="every">{t.events.every}</option>
          <option value="cron">{t.events.cron}</option>
          <option value="at">{t.events.at}</option>
        </select>
        <input type="text" value={schedValue} onChange={(e) => setSchedValue(e.target.value)} placeholder={schedKind === 'every' ? '1h' : schedKind === 'cron' ? '0 9 * * 1-5' : 'ISO timestamp'} className="flex-1 bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono" />
      </div>

      {error && <div className="text-xs text-red">{error}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors">{t.events.cancel}</button>
        <button type="submit" disabled={saving} className="btn-primary-sm">{saving ? t.events.creating : t.events.create}</button>
      </div>
    </form>
  )
}

// ==================== Main Page ====================

type Tab = 'events' | 'cron'

export function EventsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={t.events.title}
        right={
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            <button onClick={() => setTab('events')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'events' ? 'bg-bg-tertiary text-text' : 'text-text-muted hover:text-text'}`}>
              {t.events.eventLog}
            </button>
            <button onClick={() => setTab('cron')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'cron' ? 'bg-bg-tertiary text-text' : 'text-text-muted hover:text-text'}`}>
              {t.events.cronJobs}
            </button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 py-5">
        <div className="flex-1 min-h-0">
          {tab === 'events' ? <EventLogSection /> : <CronSection />}
        </div>
      </div>
    </div>
  )
}

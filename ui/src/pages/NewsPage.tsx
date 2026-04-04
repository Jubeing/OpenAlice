import { useState } from 'react'
import { type AppConfig, type NewsCollectorConfig, type NewsCollectorFeed } from '../api'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { Toggle } from '../components/Toggle'
import { useConfigPage } from '../hooks/useConfigPage'
import { PageHeader } from '../components/PageHeader'
import { useTranslation } from '../i18n'

// ==================== Page ====================

const DEFAULT_NEWS_CONFIG: NewsCollectorConfig = {
  enabled: true,
  intervalMinutes: 10,
  maxInMemory: 2000,
  retentionDays: 7,
  feeds: [],
}

export function NewsPage() {
  const { t } = useTranslation()
  const { config, status, loadError, updateConfig, updateConfigImmediate, retry } = useConfigPage<NewsCollectorConfig>({
    section: 'news',
    extract: (full: AppConfig) => (full as Record<string, unknown>).news as NewsCollectorConfig,
  })

  const cfg = config ?? DEFAULT_NEWS_CONFIG
  const enabled = cfg.enabled !== false

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={t.news.title}
        description={t.news.titleDesc}
        right={
          <div className="flex items-center gap-3">
            <SaveIndicator status={status} onRetry={retry} />
            <Toggle size="sm" checked={enabled} onChange={(v) => updateConfigImmediate({ enabled: v })} />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className={`max-w-[880px] mx-auto ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Collection Settings */}
          <ConfigSection
            title={t.news.collectionSettings}
            description={t.news.collectionSettingsDesc}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.news.fetchInterval}>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={cfg.intervalMinutes}
                  onChange={(e) => updateConfig({ intervalMinutes: Number(e.target.value) || 10 })}
                />
              </Field>
              <Field label={t.news.retention}>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={cfg.retentionDays}
                  onChange={(e) => updateConfig({ retentionDays: Number(e.target.value) || 7 })}
                />
              </Field>
            </div>
          </ConfigSection>

          {/* RSS Feeds */}
          <FeedsSection
            feeds={cfg.feeds}
            onChange={(feeds) => updateConfigImmediate({ feeds })}
          />
        </div>
        {loadError && <p className="text-[13px] text-red mt-4 max-w-[880px] mx-auto">{t.news.loadFailed}</p>}
      </div>
    </div>
  )
}

// ==================== Feeds Section ====================

function FeedsSection({
  feeds,
  onChange,
}: {
  feeds: NewsCollectorFeed[]
  onChange: (feeds: NewsCollectorFeed[]) => void
}) {
  const { t } = useTranslation()
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newSource, setNewSource] = useState('')

  const removeFeed = (index: number) => onChange(feeds.filter((_, i) => i !== index))

  const addFeed = () => {
    if (!newName.trim() || !newUrl.trim() || !newSource.trim()) return
    onChange([...feeds, { name: newName.trim(), url: newUrl.trim(), source: newSource.trim() }])
    setNewName('')
    setNewUrl('')
    setNewSource('')
  }

  const feedCount = feeds.length
  const feedsDesc = feedCount > 0
    ? t.news.rssFeedsDesc.replace('{count}', String(feedCount))
    : t.news.rssFeedsEmpty

  return (
    <ConfigSection
      title={t.news.rssFeeds}
      description={feedsDesc}
    >
      {/* Existing feeds */}
      {feeds.length > 0 && (
        <div className="space-y-2 mb-4">
          {feeds.map((feed, i) => (
            <div
              key={`${feed.source}-${i}`}
              className="flex items-center gap-3 border border-border/60 rounded-lg px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text truncate">{feed.name}</p>
                <p className="text-[12px] text-text-muted truncate">{feed.url}</p>
                <p className="text-[11px] text-text-muted/50 mt-0.5">source: {feed.source}</p>
              </div>
              <button
                onClick={() => removeFeed(i)}
                className="shrink-0 text-text-muted hover:text-red transition-colors p-1"
                title={t.news.removeFeed}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add feed form */}
      <div className="border border-border/40 rounded-lg p-4 space-y-3">
        <p className="text-[13px] font-medium text-text-muted">{t.news.addFeed}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.news.name}>
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. CoinDesk" />
          </Field>
          <Field label={t.news.source}>
            <input className={inputClass} value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. coindesk" />
          </Field>
        </div>
        <Field label={t.news.feedUrl}>
          <input className={inputClass} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/rss.xml" />
        </Field>
        <button
          onClick={addFeed}
          disabled={!newName.trim() || !newUrl.trim() || !newSource.trim()}
          className="btn-secondary"
        >
          {t.news.addFeed}
        </button>
      </div>
    </ConfigSection>
  )
}

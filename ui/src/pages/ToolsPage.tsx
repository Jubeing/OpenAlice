import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { ToolInfo } from '../api/tools'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading, EmptyState } from '../components/StateViews'
import { useTranslation } from '../i18n'

const GROUP_LABELS_KEYS: Record<string, string> = {
  thinking: 'thinkingKit',
  brain: 'brain',
  browser: 'browser',
  cron: 'cronScheduler',
  equity: 'equityData',
  'crypto-data': 'cryptoData',
  'currency-data': 'currencyData',
  news: 'news',
  'news-archive': 'newsArchive',
  analysis: 'analysisKit',
  'crypto-trading': 'cryptoTrading',
  'securities-trading': 'securitiesTrading',
}

interface ToolGroupItem {
  key: string
  labelKey: string
  tools: ToolInfo[]
}

export function ToolsPage() {
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<ToolInfo[]>([])
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.tools.load().then((res) => {
      setInventory(res.inventory)
      setDisabled(new Set(res.disabled))
      setLoaded(true)
    }).catch(() => {})
  }, [])

  const groups = useMemo<ToolGroupItem[]>(() => {
    const map = new Map<string, ToolInfo[]>()
    for (const t_item of inventory) {
      if (!map.has(t_item.group)) map.set(t_item.group, [])
      map.get(t_item.group)!.push(t_item)
    }
    return Array.from(map.entries()).map(([key, tools]) => ({
      key,
      labelKey: GROUP_LABELS_KEYS[key] ?? key,
      tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [inventory])

  const configData = useMemo(
    () => ({ disabled: [...disabled].sort() }),
    [disabled],
  )

  const save = useCallback(async (d: { disabled: string[] }) => {
    await api.tools.update(d.disabled)
  }, [])

  const { status, retry } = useAutoSave({ data: configData, save, enabled: loaded })

  const toggleTool = useCallback((name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleGroup = useCallback((tools: ToolInfo[], enable: boolean) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      for (const tool of tools) {
        if (enable) next.delete(tool.name)
        else next.add(tool.name)
      }
      return next
    })
  }, [])

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={t.tools.title}
        description={t.tools.titleDesc.replace('{count}', String(inventory.length)).replace('{groups}', String(groups.length))}
        right={<SaveIndicator status={status} onRetry={retry} />}
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {!loaded ? (
          <PageLoading />
        ) : groups.length === 0 ? (
          <EmptyState title={t.tools.noTools} description={t.tools.noToolsDesc} />
        ) : (
          <div className="max-w-[880px] mx-auto space-y-2">
            {groups.map((g) => (
              <ToolGroupCard
                key={g.key}
                groupKey={g.key}
                labelKey={g.labelKey}
                tools_list={g.tools}
                disabled={disabled}
                expanded={expanded.has(g.key)}
                onToggleExpanded={() => toggleExpanded(g.key)}
                onToggleTool={toggleTool}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== ToolGroupCard ====================

interface ToolGroupCardProps {
  groupKey: string
  labelKey: string
  tools_list: ToolInfo[]
  disabled: Set<string>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleTool: (name: string) => void
  onToggleGroup: (tools: ToolInfo[], enable: boolean) => void
}

function ToolGroupCard({
  groupKey,
  labelKey,
  tools_list,
  disabled,
  expanded,
  onToggleExpanded,
  onToggleTool,
  onToggleGroup,
}: ToolGroupCardProps) {
  const { t } = useTranslation()
  const groupLabel = (t.tools as Record<string, string>)[labelKey] ?? labelKey
  const enabledCount = tools_list.filter((t_item) => !disabled.has(t_item.name)).length
  const noneEnabled = enabledCount === 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-medium text-text truncate">{groupLabel}</span>
          <span className="text-[11px] text-text-muted shrink-0">
            {enabledCount}/{tools_list.length}
          </span>
        </button>
        <Toggle
          size="sm"
          checked={!noneEnabled}
          onChange={(v) => onToggleGroup(tools_list, v)}
        />
      </div>

      {/* Tool list */}
      <div
        className={`transition-all duration-150 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="divide-y divide-border">
          {tools_list.map((toolItem) => {
            const enabled = !disabled.has(toolItem.name)
            return (
              <div
                key={toolItem.name}
                className={`flex items-center gap-3 px-4 py-2 ${
                  enabled ? '' : 'opacity-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-text font-mono">{toolItem.name}</span>
                  {toolItem.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                      {toolItem.description}
                    </p>
                  )}
                </div>
                <Toggle
                  size="sm"
                  checked={enabled}
                  onChange={() => onToggleTool(toolItem.name)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

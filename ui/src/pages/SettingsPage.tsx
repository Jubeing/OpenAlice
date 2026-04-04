import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, type AppConfig } from '../api'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading } from '../components/StateViews'
import { useTranslation } from '../i18n'

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const { locale, t, setLocale } = useTranslation()

  useEffect(() => {
    api.config.load().then(setConfig).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={t.settings.title} />

      {config ? (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-[880px] mx-auto">
            {/* Language */}
            <ConfigSection title={t.settings.language} description={t.settings.languageDesc}>
              <div className="flex gap-2">
                <button
                  onClick={() => setLocale('en')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    locale === 'en'
                      ? 'bg-accent-dim text-accent'
                      : 'bg-bg-tertiary text-text-muted hover:text-text'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLocale('zh')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    locale === 'zh'
                      ? 'bg-accent-dim text-accent'
                      : 'bg-bg-tertiary text-text-muted hover:text-text'
                  }`}
                >
                  中文
                </button>
              </div>
            </ConfigSection>

            {/* Agent */}
            <ConfigSection title={t.settings.agent} description={t.settings.agentDesc}>
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex-1">
                  <span className="text-sm font-medium text-text">
                    {t.settings.evolutionMode}
                  </span>
                  <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                    {config.agent?.evolutionMode
                      ? t.settings.evolutionModeDesc.on
                      : t.settings.evolutionModeDesc.off}
                  </p>
                </div>
                <Toggle
                  checked={config.agent?.evolutionMode || false}
                  onChange={async (v) => {
                    try {
                      await api.config.updateSection('agent', { ...config.agent, evolutionMode: v })
                      setConfig((c) => c ? { ...c, agent: { ...c.agent, evolutionMode: v } } : c)
                    } catch {
                      // Toggle doesn't flip on failure
                    }
                  }}
                />
              </div>
            </ConfigSection>

            {/* Compaction */}
            <ConfigSection title={t.settings.compaction} description={t.settings.compactionDesc}>
              <CompactionForm config={config} />
            </ConfigSection>
          </div>
      </div>
      ) : (
        <PageLoading />
      )}
    </div>
  )
}

// ==================== Form Sections ====================

function CompactionForm({ config }: { config: AppConfig }) {
  const { t } = useTranslation()
  const [ctx, setCtx] = useState(String(config.compaction?.maxContextTokens || ''))
  const [out, setOut] = useState(String(config.compaction?.maxOutputTokens || ''))

  const data = useMemo(
    () => ({ maxContextTokens: Number(ctx), maxOutputTokens: Number(out) }),
    [ctx, out],
  )

  const save = useCallback(async (d: { maxContextTokens: number; maxOutputTokens: number }) => {
    await api.config.updateSection('compaction', d)
  }, [])

  const { status, retry } = useAutoSave({ data, save })

  return (
    <>
      <Field label={t.settings.maxContextTokens}>
        <input className={inputClass} type="number" step={1000} value={ctx} onChange={(e) => setCtx(e.target.value)} />
      </Field>
      <Field label={t.settings.maxOutputTokens}>
        <input className={inputClass} type="number" step={1000} value={out} onChange={(e) => setOut(e.target.value)} />
      </Field>
      <SaveIndicator status={status} onRetry={retry} />
    </>
  )
}


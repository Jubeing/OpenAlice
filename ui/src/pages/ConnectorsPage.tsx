import { useConfigPage } from '../hooks/useConfigPage'
import { SaveIndicator } from '../components/SaveIndicator'
import { SDKSelector, CONNECTOR_OPTIONS } from '../components/SDKSelector'
import { ConfigSection, Field, inputClass } from '../components/form'
import { PageHeader } from '../components/PageHeader'
import { useTranslation } from '../i18n'
import type { AppConfig, ConnectorsConfig } from '../api'

export function ConnectorsPage() {
  const { t } = useTranslation()
  const { config, status, loadError, updateConfig, updateConfigImmediate, retry } =
    useConfigPage<ConnectorsConfig>({
      section: 'connectors',
      extract: (full: AppConfig) => full.connectors,
    })

  // Derive selected connector IDs from enabled flags (web + mcp are always included)
  const selected = config
    ? [
        'web',
        'mcp',
        ...(config.mcpAsk.enabled ? ['mcpAsk'] : []),
        ...(config.telegram.enabled ? ['telegram'] : []),
      ]
    : ['web', 'mcp']

  const handleToggle = (id: string) => {
    if (!config) return
    if (id === 'mcpAsk') {
      updateConfigImmediate({ mcpAsk: { ...config.mcpAsk, enabled: !config.mcpAsk.enabled } })
    } else if (id === 'telegram') {
      updateConfigImmediate({ telegram: { ...config.telegram, enabled: !config.telegram.enabled } })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={t.connectors.title}
        description={t.connectors.titleDesc}
        right={<SaveIndicator status={status} onRetry={retry} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {config && (
          <div className="max-w-[880px] mx-auto">
            {/* Connector selector cards */}
            <ConfigSection
              title={t.connectors.activeConnectors}
              description={t.connectors.activeConnectorsDesc}
            >
              <SDKSelector
                options={CONNECTOR_OPTIONS}
                selected={selected}
                onToggle={handleToggle}
              />
            </ConfigSection>

            {/* Web UI config — always shown */}
            <ConfigSection
              title={t.connectors.webUi}
              description={t.connectors.webUiDesc}
            >
              <Field label={t.connectors.port}>
                <input
                  className={inputClass}
                  type="number"
                  value={config.web.port}
                  onChange={(e) => updateConfig({ web: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Server config — always shown */}
            <ConfigSection
              title={t.connectors.mcpServer}
              description={t.connectors.mcpServerDesc}
            >
              <Field label={t.connectors.port}>
                <input
                  className={inputClass}
                  type="number"
                  value={config.mcp.port}
                  onChange={(e) => updateConfig({ mcp: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Ask config */}
            {config.mcpAsk.enabled && (
              <ConfigSection
                title={t.connectors.mcpAsk}
                description={t.connectors.mcpAskDesc}
              >
                <Field label={t.connectors.port}>
                  <input
                    className={inputClass}
                    type="number"
                    value={config.mcpAsk.port ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      updateConfig({ mcpAsk: { ...config.mcpAsk, port: v ? Number(v) : undefined } })
                    }}
                    placeholder={t.connectors.placeholder.port}
                  />
                </Field>
              </ConfigSection>
            )}

            {/* Telegram config */}
            {config.telegram.enabled && (
              <ConfigSection
                title={t.connectors.telegram}
                description={t.connectors.telegramDesc}
              >
                <Field label={t.connectors.botToken}>
                  <input
                    className={inputClass}
                    type="password"
                    value={config.telegram.botToken ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botToken: e.target.value || undefined },
                      })
                    }
                    placeholder={t.connectors.placeholder.botToken}
                  />
                </Field>
                <Field label={t.connectors.botUsername}>
                  <input
                    className={inputClass}
                    value={config.telegram.botUsername ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botUsername: e.target.value || undefined },
                      })
                    }
                    placeholder={t.connectors.placeholder.botUsername}
                  />
                </Field>
                <Field label={t.connectors.allowedChatIds}>
                  <input
                    className={inputClass}
                    value={config.telegram.chatIds.join(', ')}
                    onChange={(e) =>
                      updateConfig({
                        telegram: {
                          ...config.telegram,
                          chatIds: e.target.value
                            ? e.target.value
                                .split(',')
                                .map((s) => Number(s.trim()))
                                .filter((n) => !isNaN(n))
                            : [],
                        },
                      })
                    }
                    placeholder={t.connectors.placeholder.chatIds}
                  />
                </Field>
              </ConfigSection>
            )}
          </div>
        )}
        {loadError && <p className="text-[13px] text-red">{t.connectors.loadFailed}</p>}
      </div>
    </div>
  )
}

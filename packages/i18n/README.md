# OpenAlice i18n Patch

Chinese (简体中文) and English internationalization support for OpenAlice.

## Features

- Language switcher in Settings page (English / 中文)
- Translated sidebar navigation
- Translated Dev page
- Translated AI Provider, Trading, Tools, Connectors pages
- Translated News, Market Data, Heartbeat, Agent Status, Events, Portfolio, Chat pages

## Installation

```bash
# Apply the patch
node packages/i18n/scripts/apply-patch.mjs

# Build
pnpm install
pnpm build:backend && pnpm build:ui
```

## Uninstallation

```bash
# Remove the patch
node packages/i18n/scripts/remove-patch.mjs

# Rebuild
pnpm build:backend && pnpm build:ui
```

## Files Modified (18 patches)

- `ui/src/main.tsx` - Added I18nProvider wrapper
- `ui/src/components/Sidebar.tsx` - Dynamic navigation labels
- `ui/src/pages/SettingsPage.tsx` - Language selector
- `ui/src/pages/DevPage.tsx` - Translated UI strings
- `ui/src/pages/AIProviderPage.tsx` - Translated backend/auth/model forms
- `ui/src/pages/TradingPage.tsx` - Translated account/wizard/guards
- `ui/src/pages/ToolsPage.tsx` - Translated group labels and tool names
- `ui/src/pages/ConnectorsPage.tsx` - Translated connector config
- `ui/src/pages/NewsPage.tsx` - Translated RSS feed management
- `ui/src/pages/MarketDataPage.tsx` - Translated data backend/providers
- `ui/src/pages/HeartbeatPage.tsx` - Translated config and prompt editor
- `ui/src/pages/AgentStatusPage.tsx` - Translated tool call table
- `ui/src/pages/EventsPage.tsx` - Translated event log and cron jobs
- `ui/src/pages/PortfolioPage.tsx` - Translated portfolio metrics
- `ui/src/pages/ChatPage.tsx` - Translated channels and popover
- `ui/src/i18n/en.ts` - English translations
- `ui/src/i18n/zh.ts` - Chinese translations
- `ui/src/i18n/index.tsx` - i18n context and hook

## New Files

- `ui/src/i18n/index.tsx` - i18n context and hook
- `ui/src/i18n/en.ts` - English translations
- `ui/src/i18n/zh.ts` - Chinese translations

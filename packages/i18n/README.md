# OpenAlice i18n Patch

Chinese (简体中文) and English internationalization support for OpenAlice.

## Features

- Language switcher in Settings page (English / 中文)
- Translated sidebar navigation
- Translated Dev page

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

## Files Modified

- `ui/src/main.tsx` - Added I18nProvider wrapper
- `ui/src/components/Sidebar.tsx` - Dynamic navigation labels
- `ui/src/pages/SettingsPage.tsx` - Language selector
- `ui/src/pages/DevPage.tsx` - Translated UI strings

## New Files

- `ui/src/i18n/index.tsx` - i18n context and hook
- `ui/src/i18n/en.ts` - English translations
- `ui/src/i18n/zh.ts` - Chinese translations

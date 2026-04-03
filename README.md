# Alice-Longbridge

OpenAlice 补丁包集合。

## Packages

### `packages/longport`

Longbridge 券商集成补丁。

```bash
# 应用补丁
node packages/longport/scripts/apply-patch.mjs

# 安装依赖并构建
pnpm install
pnpm build:backend && pnpm build:ui
```

### `packages/i18n`

中文/英文国际化补丁。

```bash
# 应用补丁
node packages/i18n/scripts/apply-patch.mjs

# 构建
pnpm build:ui
```

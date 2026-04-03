# Longbridge Broker Patch for OpenAlice

Adds **Longbridge** as a new trading platform option in the OpenAlice "New Account" wizard.

## Features

- **Markets**: Hong Kong (SEHK), US (NASDAQ/NYSE/ARCA), Singapore (SGX)
- **Order types**: Market, Limit, Stop, Stop-Limit
- **Auto-refresh token**: Uses HMAC-SHA256 to automatically renew access tokens every 90 days
- **Token refresh button**: Manual refresh via the Trading UI
- **Dynamic UI**: Appears automatically in the Platform selector on the Trading page

## Prerequisites

- [Longbridge OpenAPI account](https://open.longbridge.com/en/) — App Key, App Secret, Access Token
- Node.js 20+
- OpenAlice installation (pnpm monorepo)

## Installation

```bash
# 1. Apply the patch (from OpenAlice root)
node packages/longport/scripts/apply-patch.mjs

# 2. Install dependencies
pnpm install

# 3. Build the broker package
pnpm --filter @traderalice/longport build

# 4. Restart OpenAlice
pnpm dev
```

## Token Setup

### Manual Token (one-time)

1. Go to **Trading → New Account → Platform → Longbridge (HK/US/SG)**
2. Enter your **App Key**, **App Secret**, and **Access Token**
3. Toggle **Auto-refresh Token** off (default)
4. Click **Create Account**

### Auto-Refresh Token (recommended)

The access token expires every ~90 days. Enable auto-refresh to have it renewed automatically using HMAC-SHA256 signing — no re-authentication needed.

1. Enable **Auto-refresh Token** in the account form
2. Set up a cron job (or use OpenAlice's built-in cron):

```bash
# Option A: Crontab (runs monthly)
0 4 1 * * cd /home/ubuntu/OpenAlice && node packages/longport/scripts/refresh-token.mjs

# Option B: OpenAlice cron (configure in data/config/cron.json)
```

## Uninstallation

```bash
# Remove the patch
node packages/longport/scripts/remove-patch.mjs

# Reinstall dependencies
pnpm install

# Restart OpenAlice
pnpm dev
```

## Structure

```
packages/longport/
├── package.json          # pnpm workspace package definition
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts          # Public exports
│   ├── longport-broker.ts     # IBroker implementation
│   ├── longport-auth.ts       # Token refresh (HMAC-SHA256)
│   ├── longport-contracts.ts  # Symbol ↔ Contract mapping
│   └── longport-types.ts      # Raw API types
└── scripts/
    ├── apply-patch.mjs       # Install patch
    ├── remove-patch.mjs       # Uninstall patch
    └── refresh-token.mjs      # Cron script for auto-refresh
```

## Broker Fields (UI)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| App Key | text | Yes | LongPort App Key from developer portal |
| App Secret | password | Yes | LongPort App Secret |
| Access Token | password | Yes | LongPort Access Token |
| Auto-refresh Token | boolean | No | Automatically refresh every 90 days |

## API Reference

### Refresh Token (Node.js)

```typescript
import { refreshAccessToken, isTokenExpiringSoon } from '@traderalice/longport'

const { token, expiredAt } = await refreshAccessToken({
  appKey: 'your-app-key',
  appSecret: 'your-app-secret',
  accessToken: 'current-token',
})

console.log(`New token expires: ${expiredAt}`)
```

### Check Token Expiry

```typescript
import { isTokenExpiringSoon } from '@traderalice/longport'

if (isTokenExpiringSoon('2026-06-01T00:00:00Z', 7)) {
  console.log('Token expiring within 7 days — refresh recommended')
}
```

## License

Same as OpenAlice — AGPL-3.0

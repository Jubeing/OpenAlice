import { Hono } from 'hono'
import type { EngineContext } from '../../../core/types.js'
import {
  readAccountsConfig, writeAccountsConfig,
  accountConfigSchema,
} from '../../../core/config.js'
import { createBroker } from '../../../domain/trading/brokers/factory.js'
import { BROKER_REGISTRY } from '../../../domain/trading/brokers/registry.js'

// ==================== Credential helpers ====================

/** Mask a secret string: show last 4 chars, prefix with "****" */
function mask(value: string): string {
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}

/** Field names that contain sensitive values. Convention-based, not hardcoded per broker. */
const SENSITIVE = /key|secret|password|token/i

/** Mask all sensitive string fields in a config object (recurses into nested objects). */
function maskSecrets<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string' && v.length > 0 && SENSITIVE.test(k)) {
      ;(result as Record<string, unknown>)[k] = mask(v)
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      ;(result as Record<string, unknown>)[k] = maskSecrets(v as Record<string, unknown>)
    }
  }
  return result
}

/** Restore masked values (****...) from existing config (recurses into nested objects). */
function unmaskSecrets(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
): void {
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' && v.startsWith('****') && typeof existing[k] === 'string') {
      body[k] = existing[k]
    } else if (v && typeof v === 'object' && !Array.isArray(v) && existing[k] && typeof existing[k] === 'object') {
      unmaskSecrets(v as Record<string, unknown>, existing[k] as Record<string, unknown>)
    }
  }
}

// ==================== Routes ====================

/** Trading config CRUD routes: accounts */
export function createTradingConfigRoutes(ctx: EngineContext) {
  const app = new Hono()

  // ==================== Broker types (for dynamic UI rendering) ====================

  app.get('/broker-types', (c) => {
    const brokerTypes = Object.entries(BROKER_REGISTRY).map(([type, entry]) => ({
      type,
      name: entry.name,
      description: entry.description,
      badge: entry.badge,
      badgeColor: entry.badgeColor,
      fields: entry.configFields,
      subtitleFields: entry.subtitleFields,
      guardCategory: entry.guardCategory,
    }))
    return c.json({ brokerTypes })
  })

  // ==================== Read all ====================

  app.get('/', async (c) => {
    try {
      const accounts = await readAccountsConfig()
      const maskedAccounts = accounts.map((a) => maskSecrets({ ...a }))
      return c.json({ accounts: maskedAccounts })
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })

  // ==================== Accounts CRUD ====================

  app.put('/accounts/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      if (body.id !== id) {
        return c.json({ error: 'Body id must match URL id' }, 400)
      }

      // Restore masked credentials from existing config
      const accounts = await readAccountsConfig()
      const existing = accounts.find((a) => a.id === id)
      if (existing) {
        unmaskSecrets(body, existing as unknown as Record<string, unknown>)
      }

      const validated = accountConfigSchema.parse(body)

      const idx = accounts.findIndex((a) => a.id === id)
      if (idx >= 0) {
        accounts[idx] = validated
      } else {
        accounts.push(validated)
      }
      await writeAccountsConfig(accounts)

      // Handle enabled state changes at runtime
      const isNew = !existing
      const wasEnabled = existing?.enabled !== false
      const nowEnabled = validated.enabled !== false
      if (isNew && nowEnabled) {
        // New account — start it
        ctx.accountManager.reconnectAccount(id).catch(() => {})
      } else if (!isNew && wasEnabled && !nowEnabled) {
        // Disabled — close running account
        await ctx.accountManager.removeAccount(id)
      } else if (!isNew && !wasEnabled && nowEnabled) {
        // Was disabled, now enabled — reconnect
        ctx.accountManager.reconnectAccount(id).catch(() => {})
      }

      return c.json(validated)
    } catch (err) {
      if (err instanceof Error && err.name === 'ZodError') {
        return c.json({ error: 'Validation failed', details: JSON.parse(err.message) }, 400)
      }
      return c.json({ error: String(err) }, 500)
    }
  })

  app.delete('/accounts/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const accounts = await readAccountsConfig()
      const filtered = accounts.filter((a) => a.id !== id)
      if (filtered.length === accounts.length) {
        return c.json({ error: `Account "${id}" not found` }, 404)
      }
      await writeAccountsConfig(filtered)
      // Close and deregister running account instance if any
      await ctx.accountManager.removeAccount(id)
      return c.json({ success: true })
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })

  // ==================== Test Connection ====================

  app.post('/test-connection', async (c) => {
    let broker: { init: () => Promise<void>; getAccount: () => Promise<unknown>; close: () => Promise<void> } | null = null
    try {
      const body = await c.req.json()
      const accountConfig = accountConfigSchema.parse({ ...body, id: body.id ?? '__test__' })

      broker = createBroker(accountConfig)
      await broker.init()
      const account = await broker.getAccount()
      return c.json({ success: true, account })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, error: msg }, 400)
    } finally {
      try { await broker?.close() } catch { /* best effort */ }
    }
  })

  // ==================== Longbridge Specific ====================

  app.post('/longbridge/refresh-token', async (c) => {
    try {
      const { appKey, appSecret, refreshToken } = await c.req.json()
      if (!appKey || !appSecret || !refreshToken) {
        return c.json({ error: 'appKey, appSecret, and refreshToken are required' }, 400)
      }

      // Create a temporary broker to call the refresh API
      const tempConfig = {
        id: '__refresh-test__',
        type: 'longbridge' as const,
        brokerConfig: { appKey, appSecret, refreshToken, activeAccessToken: refreshToken },
      }
      let broker: { init: () => Promise<void>; refreshToken: () => Promise<{ accessToken: string; refreshToken: string; expiresAt: string }>; close: () => Promise<void> } | null = null
      try {
        broker = createBroker(tempConfig as any)
        await broker.init()
        const result = await broker.refreshToken()
        return c.json({ accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt: result.expiresAt })
      } finally {
        await broker?.close()
      }
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  })

  return app
}

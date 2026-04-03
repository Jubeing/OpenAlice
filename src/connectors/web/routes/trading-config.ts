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
      const wasEnabled = existing?.enabled !== false
      const nowEnabled = validated.enabled !== false
      if (wasEnabled && !nowEnabled) {
        // Disabled — close running account
        await ctx.accountManager.removeAccount(id)
      } else if (!wasEnabled && nowEnabled) {
        // Enabled — start account
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


  // ==================== LongPort OAuth ====================

  app.post('/longbridge/oauth-url', async (c) => {
    try {
      const { appKey, appSecret } = await c.req.json()
      if (!appKey || !appSecret) {
        return c.json({ error: 'appKey and appSecret are required' }, 400)
      }

      // Register OAuth client to get client credentials
      const registerResp = await fetch('https://openapi.longbridge.com/oauth2/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'OpenAlice-LongPort',
          redirect_uris: ['http://localhost:60355/callback', 'https://openalice.local/callback'],
          grant_types: ['authorization_code', 'refresh_token'],
        }),
      })
      const registered = await registerResp.json() as { client_id?: string; client_secret?: string }
      if (!registered.client_id) {
        return c.json({ error: 'OAuth registration failed', details: registered }, 400)
      }

      // Build authorization URL
      // Pass appKey/appSecret to callback via state (base64 encoded) so callback can exchange code
      const stateObj = JSON.stringify({ appKey, appSecret, redirectUri: 'https://openalice.local/callback' })
      const stateBase64 = Buffer.from(stateObj).toString('base64')
      const params = new URLSearchParams({
        client_id: registered.client_id,
        redirect_uri: 'https://openalice.local/callback',
        response_type: 'code',
        scope: 'trade market_data',
        state: stateBase64,
      })
      const authUrl = `https://openapi.longbridge.com/oauth2/authorize?${params}`

      return c.json({
        url: authUrl,
        clientId: registered.client_id,
        clientSecret: registered.client_secret ?? '',
        note: 'Visit the URL above, authorize, then paste the authorization code from the redirect.',
      })
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })

  app.post('/longbridge/exchange-token', async (c) => {
    try {
      const { appKey, appSecret, code, redirectUri } = await c.req.json()
      if (!appKey || !appSecret || !code) {
        return c.json({ error: 'appKey, appSecret, and code are required' }, 400)
      }

      const resp = await fetch('https://openapi.longbridge.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri ?? 'https://openalice.local/callback',
          client_id: appKey,
          client_secret: appSecret,
        }),
      })
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }

      if (data.error || !data.access_token) {
        return c.json({ error: data.error ?? 'Token exchange failed', details: data }, 400)
      }

      const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString()

      return c.json({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        expiresAt,
      })
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })

  // ==================== LongPort Token Refresh ====================

  app.post('/longbridge/refresh-token', async (c) => {
    try {
      const { appKey, appSecret, accessToken } = await c.req.json()
      if (!appKey || !appSecret || !accessToken) {
        return c.json({ error: 'appKey, appSecret, and accessToken are required' }, 400)
      }

      const expireDate = new Date()
      expireDate.setDate(expireDate.getDate() + 90)
      const expiredAt = expireDate.toISOString()

      const crypto = await import('crypto')
      const timestamp = Date.now().toString()
      const uri = '/v1/token/refresh'
      const canonicalParams = `expired_at=${encodeURIComponent(expiredAt)}`
      const canonicalRequest =
        `GET|${uri}|${canonicalParams}|authorization:${accessToken}\nx-api-key:${appKey}\nx-timestamp:${timestamp}\n|authorization;x-api-key;x-timestamp|`
      const toSign = `HMAC-SHA256|${crypto.createHash('sha1').update(canonicalRequest, 'utf8').digest('hex')}`
      const signStr = `HMAC-SHA256|${crypto.createHash('sha1').update(toSign, 'utf8').digest('hex')}`
      const signature = crypto.createHmac('sha256', appSecret).update(signStr, 'utf8').digest('hex')
      const finalSignature = `HMAC-SHA256 SignedHeaders=authorization;x-api-key;x-timestamp, Signature=${signature}`

      const url = `https://openapi.longbridgeapp.com${uri}?${canonicalParams}`
      const apiResp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': accessToken,
          'x-api-key': appKey,
          'x-timestamp': timestamp,
          'x-api-signature': finalSignature,
        },
      })
      const result = await apiResp.json() as { code?: number; data?: { token?: string; expired_at?: string }; message?: string }

      if (result.code !== 0 || !result.data?.token) {
        return c.json({ error: `Token refresh failed: ${result.message ?? 'Unknown error'}`, code: result.code }, 400)
      }

      return c.json({
        accessToken: result.data.token,
        expiresAt: result.data.expired_at ?? expiredAt,
      })
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })


  // ==================== LongPort OAuth Callback ====================

  // GET /api/trading/config/longbridge/callback
  // Called by LongPort after user authorizes — exchanges code for token and closes popup.
  app.get('/longbridge/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')
    const errorDesc = c.req.query('error_description')

    if (error || !code) {
      const errMsg = encodeURIComponent(errorDesc ?? error ?? 'Authorization denied')
      return c.html(`
        <html><body>
          <p style="font-family:sans-serif;color:red">Authorization failed: ${errorDesc ?? error}</p>
          <script>window.opener?.postMessage({ longbridge_oauth_error: '${errMsg}' }, '*'); setTimeout(() => window.close(), 2000)</script>
        </body></html>
      `)
    }

    // Exchange code for token using appKey/appSecret from state
    let appKey = '', appSecret = '', redirectUri = 'https://openalice.local/callback'
    try {
      if (state) {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString())
        appKey = parsed.appKey ?? ''
        appSecret = parsed.appSecret ?? ''
        redirectUri = parsed.redirectUri ?? redirectUri
      }
    } catch {}

    if (!appKey || !appSecret) {
      return c.html(`<html><body><p style="font-family:sans-serif">Missing app credentials in state.</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`)
    }

    try {
      const resp = await fetch('https://openapi.longbridge.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: appKey,
          client_secret: appSecret,
        }),
      })
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }

      if (data.error || !data.access_token) {
        return c.html(`<html><body><p style="font-family:sans-serif;color:red">Token exchange failed: ${data.error ?? 'Unknown error'}</p><script>window.opener?.postMessage({ longbridge_oauth_error: String(data.error) }, '*'); setTimeout(() => window.close(), 3000)</script></body></html>`)
      }

      const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString()
      return c.html(`
        <html><body>
          <p style="font-family:sans-serif;color:green">Authorization successful! Token acquired.</p>
          <p style="font-family:sans-serif;font-size:12px">This window will close automatically...</p>
          <script>
            window.opener?.postMessage({
              longbridge_oauth_success: true,
              accessToken: '${data.access_token}',
              expiresIn: ${data.expires_in ?? 86400}
            }, '*')
            setTimeout(() => window.close(), 1500)
          </script>
        </body></html>
      `)
    } catch (err) {
      return c.html(`<html><body><p style="font-family:sans-serif;color:red">Error: ${String(err)}</p><script>setTimeout(() => window.close(), 5000)</script></body></html>`)
    }
  })

  return app
}

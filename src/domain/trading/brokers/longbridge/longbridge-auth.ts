/**
 * Longbridge OAuth2 helper — authorization URL generation and token exchange.
 *
 * Flow:
 *  1. Build the authorization URL with buildAuthorizationUrl()
 *  2. Open the URL in a browser, authorize the app
 *  3. Longbridge redirects to redirectUri with a ?code=... parameter
 *  4. Exchange the code for tokens with exchangeCode()
 *  5. Store the returned (accessToken, refreshToken, expiresAt) in accounts.json
 */

import https from 'https'
import { URLSearchParams } from 'url'

export interface OAuthConfig {
  clientId: string
  clientSecret?: string
  redirectUri: string
}

/** Build the OAuth2 authorization URL. */
export function buildAuthorizationUrl(config: OAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'trading',
    ...(state ? { state } : {}),
  })
  return `https://open.longbridge.com/oauth2/authorize?${params.toString()}`
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(
  config: OAuthConfig,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    redirect_uri: config.redirectUri,
  })

  const result = await postToken(params)

  if (!result.access_token || !result.refresh_token) {
    throw new Error(`Token exchange failed (code=${result.code}): ${result.msg ?? 'Unknown error'}`)
  }

  const expiresAt = new Date(Date.now() + (result.expires_in ?? 2592000) * 1000).toISOString()
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt,
  }
}

/**
 * Refresh access token using OAuth 2.0 refresh_token grant.
 *
 * The refresh_token must have been obtained via the OAuth2 authorization
 * code flow.  Tokens from other origins (e.g. mobile OAuth) cannot be
 * refreshed this way and will receive "invalid_grant" errors.
 */
export async function refreshAccessToken(config: {
  appKey: string
  appSecret?: string
  refreshToken: string
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.appKey,
    ...(config.appSecret ? { client_secret: config.appSecret } : {}),
    refresh_token: config.refreshToken,
  })

  const result = await postToken(params)

  if (!result.access_token) {
    throw new Error(`Token refresh failed (code=${result.code}): ${result.msg ?? 'Unknown error'}`)
  }

  const expiresAt = new Date(Date.now() + (result.expires_in ?? 2592000) * 1000).toISOString()
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? config.refreshToken,
    expiresAt,
  }
}

async function postToken(params: URLSearchParams): Promise<{
  access_token?: string
  refresh_token?: string
  expires_in?: number
  msg?: string
  code?: number
}> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'openapi.longbridge.com',
        path: '/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(params.toString()),
        },
      },
      (res) => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error(`Invalid JSON: ${data}`)) }
        })
      },
    )
    req.on('error', reject)
    req.write(params.toString())
    req.end()
  })
}

export function isTokenExpiringSoon(expiredAt: string, days = 7): boolean {
  return new Date(expiredAt).getTime() - Date.now() < days * 24 * 60 * 60 * 1000
}

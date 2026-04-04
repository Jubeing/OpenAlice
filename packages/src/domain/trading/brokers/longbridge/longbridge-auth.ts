/**
 * Longbridge token refresh — HMAC-SHA256 signing.
 */

import crypto from 'crypto'
import https from 'https'

export interface AuthConfig {
  appKey: string
  appSecret: string
  accessToken: string
}

export interface TokenRefreshResult {
  token: string
  expiredAt: string
}

/** Refresh access token using HMAC-SHA256 (LongBridge V1 signing). */
export async function refreshAccessToken(config: AuthConfig): Promise<TokenRefreshResult> {
  const timestamp = Date.now().toString()
  const expireDate = new Date()
  expireDate.setDate(expireDate.getDate() + 90)
  const expiredAt = expireDate.toISOString()
  const uri = '/v1/token/refresh'
  const canonicalParams = `expired_at=${encodeURIComponent(expiredAt)}`
  const canonicalRequest =
    `GET|${uri}|${canonicalParams}|authorization:${config.accessToken}\nx-api-key:${config.appKey}\nx-timestamp:${timestamp}\n|authorization;x-api-key;x-timestamp|`
  const toSign = `HMAC-SHA256|${crypto.createHash('sha1').update(canonicalRequest, 'utf8').digest('hex')}`
  const signStr = `HMAC-SHA256|${crypto.createHash('sha1').update(toSign, 'utf8').digest('hex')}`
  const signature = crypto.createHmac('sha256', config.appSecret).update(signStr, 'utf8').digest('hex')
  const finalSig = `HMAC-SHA256 SignedHeaders=authorization;x-api-key;x-timestamp, Signature=${signature}`

  const url = `https://openapi.longbridgeapp.com${uri}?${canonicalParams}`

  const result = await new Promise<{ code: number; data?: { token: string; expired_at: string }; message?: string }>((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Authorization: config.accessToken,
        'x-api-key': config.appKey,
        'x-timestamp': timestamp,
        'x-api-signature': finalSig,
      },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON: ${data}`)) }
      })
    })
    req.on('error', reject)
    req.end()
  })

  if (result.code !== 0 || !result.data?.token) {
    throw new Error(`Token refresh failed (code=${result.code}): ${result.message ?? 'Unknown'}`)
  }

  return { token: result.data.token, expiredAt: result.data.expired_at }
}

export function isTokenExpiringSoon(expiredAt: string, days = 7): boolean {
  return new Date(expiredAt).getTime() - Date.now() < days * 24 * 60 * 60 * 1000
}

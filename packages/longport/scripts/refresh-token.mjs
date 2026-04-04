#!/usr/bin/env node
/**
 * Longbridge token refresh cron script.
 *
 * Auto-refreshes Longbridge OAuth2 refresh tokens for all Longbridge accounts
 * on the 1st of every month (or when manually triggered).
 *
 * Usage:
 *   node packages/longport/scripts/refresh-token.mjs
 *
 * Crontab entry (runs on the 1st of every month at 03:00 Asia/Shanghai):
 *   0 3 1 * * cd /home/ubuntu/OpenAlice && node packages/longport/scripts/refresh-token.mjs >> ~/.openclaw/logs/longbridge_refresh.log 2>&1
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import https from 'https'

const ROOT = process.env.ALICE_ROOT || '/home/ubuntu/OpenAlice'

async function refreshAccessToken({ appKey, appSecret, refreshToken }) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appKey,
    ...(appSecret ? { client_secret: appSecret } : {}),
    refresh_token: refreshToken,
  })

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
          try {
            const result = JSON.parse(data)
            if (!result.access_token) {
              reject(new Error(`Token refresh failed (code=${result.code}): ${result.msg ?? 'Unknown'}`))
            } else {
              const expiresAt = new Date(Date.now() + (result.expires_in ?? 2592000) * 1000).toISOString()
              resolve({
                accessToken: result.access_token,
                refreshToken: result.refresh_token ?? refreshToken,
                expiresAt,
              })
            }
          } catch {
            reject(new Error(`Invalid JSON: ${data}`))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(params.toString())
    req.end()
  })
}

async function main() {
  const accountsPath = resolve(ROOT, 'data/config/accounts.json')
  if (!existsSync(accountsPath)) {
    console.error('accounts.json not found at:', accountsPath)
    process.exit(1)
  }

  const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'))
  const longbridgeAccounts = accounts.filter((a) => a.type === 'longbridge')

  if (longbridgeAccounts.length === 0) {
    console.log('No Longbridge accounts found.')
    return
  }

  let changed = false
  for (const account of longbridgeAccounts) {
    const { appKey, appSecret, refreshToken } = account.brokerConfig
    if (!appKey || !appSecret || !refreshToken) {
      console.warn(`Skipping ${account.id}: missing appKey, appSecret, or refreshToken`)
      continue
    }

    try {
      console.log(`Refreshing token for ${account.id}...`)
      const result = await refreshAccessToken({ appKey, appSecret, refreshToken })

      // Update brokerConfig with new tokens
      // activeAccessToken is no longer stored; SDK uses refreshToken directly
      account.brokerConfig.refreshToken = result.refreshToken
      account.brokerConfig.tokenExpiry = result.expiresAt

      changed = true
      console.log(`✓ ${account.id}: token refreshed (new refresh token stored), expires ${result.expiresAt}`)
    } catch (err) {
      console.error(`✗ ${account.id}: refresh failed — ${err.message}`)
      console.error('  Hint: If error is "invalid_grant", the refresh token is invalid/revoked.')
      console.error('  Solution: Re-run OAuth2 authorization to get a new refresh token.')
    }
  }

  if (changed) {
    writeFileSync(accountsPath, JSON.stringify(accounts, null, 2))
    console.log('\nAccounts updated.')
  }

  console.log('\nToken refresh complete.')
}

main().catch(console.error)

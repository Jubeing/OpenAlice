#!/usr/bin/env node
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

const PATCHES = [
  '0001-main-tsx.patch',
  '0002-Sidebar-tsx.patch',
  '0003-SettingsPage-tsx.patch',
  '0004-DevPage-tsx.patch',
  '0005-AIProviderPage-tsx.patch',
  '0006-TradingPage-tsx.patch',
  '0007-ToolsPage-tsx.patch',
  '0008-ConnectorsPage-tsx.patch',
  '0009-NewsPage-tsx.patch',
  '0010-MarketDataPage-tsx.patch',
  '0011-HeartbeatPage-tsx.patch',
  '0012-AgentStatusPage-tsx.patch',
  '0013-EventsPage-tsx.patch',
  '0014-PortfolioPage-tsx.patch',
  '0015-ChatPage-tsx.patch',
  '0016-i18n-en-ts.patch',
  '0017-i18n-zh-ts.patch',
  '0018-i18n-index-tsx.patch',
]

function patch(patchFile) {
  const patchPath = resolve(__dirname, '../patches', patchFile)
  console.log(`Applying patch: ${patchFile}`)
  try {
    execSync(`git apply ${patchPath}`, { cwd: ROOT, stdio: 'inherit' })
  } catch (e) {
    console.error(`Failed to apply ${patchFile}`)
    process.exit(1)
  }
}

// Apply patches in order
for (const p of PATCHES) patch(p)

// Copy new i18n files
console.log('Copying i18n files...')
execSync(`cp ${resolve(__dirname, '../en.ts')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })
execSync(`cp ${resolve(__dirname, '../zh.ts')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })
execSync(`cp ${resolve(__dirname, '../index.tsx')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })

console.log('✅ i18n patch applied successfully')
console.log('Run: pnpm build:ui')

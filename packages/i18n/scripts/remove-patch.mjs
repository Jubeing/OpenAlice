#!/usr/bin/env node
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

const PATCHES = [
  '0018-i18n-index-tsx.patch',
  '0017-i18n-zh-ts.patch',
  '0016-i18n-en-ts.patch',
  '0015-ChatPage-tsx.patch',
  '0014-PortfolioPage-tsx.patch',
  '0013-EventsPage-tsx.patch',
  '0012-AgentStatusPage-tsx.patch',
  '0011-HeartbeatPage-tsx.patch',
  '0010-MarketDataPage-tsx.patch',
  '0009-NewsPage-tsx.patch',
  '0008-ConnectorsPage-tsx.patch',
  '0007-ToolsPage-tsx.patch',
  '0006-TradingPage-tsx.patch',
  '0005-AIProviderPage-tsx.patch',
  '0004-DevPage-tsx.patch',
  '0003-SettingsPage-tsx.patch',
  '0002-Sidebar-tsx.patch',
  '0001-main-tsx.patch',
]

function unpatch(patchFile) {
  const patchPath = resolve(__dirname, '../patches', patchFile)
  console.log(`Reverting patch: ${patchFile}`)
  try {
    execSync(`git apply -R ${patchPath}`, { cwd: ROOT, stdio: 'inherit' })
  } catch (e) {
    // Ignore if patch not applied
  }
}

// Revert patches in reverse order
for (const p of PATCHES) unpatch(p)

// Remove i18n files
console.log('Removing i18n files...')
try {
  execSync(`rm ${ROOT}/ui/src/i18n/en.ts`, { stdio: 'inherit' })
  execSync(`rm ${ROOT}/ui/src/i18n/zh.ts`, { stdio: 'inherit' })
  execSync(`rm ${ROOT}/ui/src/i18n/index.tsx`, { stdio: 'inherit' })
} catch (e) {
  // Ignore if files don't exist
}

console.log('✅ i18n patch removed')

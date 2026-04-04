#!/usr/bin/env node
/**
 * Alice-Longbridge patch uninstaller for OpenAlice.
 *
 * Run from the OpenAlice root directory:
 *   node packages/longport/scripts/remove-patch.mjs
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()

// ---- 0. Remove Alice-Longbridge packages from packages/ ----

// Note: longport-mcp was merged into longport (under mcp/ subdirectory)
const patchPackages = ['i18n', 'longport', 'opentypebb', 'ibkr']
for (const pkg of patchPackages) {
  const dir = resolve(ROOT, 'packages', pkg)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
    console.log(`✓ Removed packages/${pkg}/`)
  }
}

// ---- 1. Remove longbridge from registry.ts ----

const registryPath = resolve(ROOT, 'src/domain/trading/brokers/registry.ts')
if (existsSync(registryPath)) {
  let content = readFileSync(registryPath, 'utf8')

  content = content.replace(
    /import \{ LongbridgeBroker \} from '\.\/longbridge\/LongbridgeBroker\.js'\n?/g,
    '',
  )

  content = content.replace(
    /\n  longbridge: \{[\s\S]*?guardCategory: 'securities',\n  },\n?/g,
    '',
  )

  writeFileSync(registryPath, content)
  console.log('✓ registry.ts cleaned')
}

// ---- 2. Remove longbridge from index.ts ----

const indexPath = resolve(ROOT, 'src/domain/trading/brokers/index.ts')
if (existsSync(indexPath)) {
  let content = readFileSync(indexPath, 'utf8')

  content = content.replace(
    /\n\n\/\/ Longbridge\nexport \{ LongbridgeBroker \} from '\.\/longbridge\/LongbridgeBroker\.js'\nexport \{ longbridgeConfigFields \} from '\.\/longbridge\/LongbridgeBroker\.js'\n?/g,
    '',
  )

  writeFileSync(indexPath, content)
  console.log('✓ index.ts cleaned')
}

// ---- 3. Remove systemd service ----

console.log('\n🔧 Removing systemd service...')
const systemdDest = '/etc/systemd/system/openalice.service'

try {
  execSync('sudo systemctl stop openalice', { stdio: 'pipe' })
  execSync('sudo systemctl disable openalice', { stdio: 'pipe' })
  execSync(`sudo rm -f ${systemdDest}`, { stdio: 'pipe' })
  execSync('sudo systemctl daemon-reload', { stdio: 'pipe' })
  console.log('✓ systemd service removed')
} catch (e) {
  console.log('⚠ Could not remove systemd service:', e.message)
}

console.log('\n✅ Alice-Longbridge patch removed successfully!\n')

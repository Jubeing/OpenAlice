#!/usr/bin/env node
/**
 * Alice-Longbridge patch installer for OpenAlice.
 *
 * Run from the OpenAlice root directory:
 *   ALICE_LONGBRIDGE_ROOT=/path/to/Alice-Longbridge node packages/longport/scripts/apply-patch.mjs
 *
 * This script:
 *   1. Copies all Alice-Longbridge packages to OpenAlice/packages/ (workspace packages)
 *   2. Applies i18n patches (ui translations)
 *   3. Patches src/domain/trading/brokers/registry.ts  (adds longbridge entry)
 *   4. Patches src/domain/trading/brokers/index.ts      (adds longbridge export)
 *   5. Installs systemd service (auto-start + crash recovery)
 */

import { readFileSync, writeFileSync, existsSync, cpSync, rmSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()
const LONGPORT_PKG = resolve(__dirname, '..')

// ---- Find Alice-Longbridge root ----
function findAliceLongbridge() {
  const candidates = [
    process.env.ALICE_LONGBRIDGE_ROOT,
    resolve(__dirname, '../../..'),
    '/home/ubuntu/.openclaw/workspace/Alice-Longbridge',
    resolve(ROOT, '../Alice-Longbridge'),
  ]
  for (const c of candidates) {
    if (c && existsSync(resolve(c, 'packages'))) return c
  }
  return null
}

const ALICE_LONGBRIDGE_ROOT = findAliceLongbridge()
if (!ALICE_LONGBRIDGE_ROOT) {
  console.error('❌ Could not find Alice-Longbridge source (tried common locations)')
  console.error('   Set ALICE_LONGBRIDGE_ROOT env var to point to Alice-Longbridge root')
  process.exit(1)
}
console.log(`   Alice-Longbridge root: ${ALICE_LONGBRIDGE_ROOT}`)

const ALICE_PKGS_SRC = resolve(ALICE_LONGBRIDGE_ROOT, 'packages')

// ---- Helpers ----

function patchFile(filePath, patches) {
  let content = readFileSync(filePath, 'utf8')
  for (const { find, replace } of patches) {
    if (!content.includes(find)) {
      console.error(`⚠  Could not find patch marker in ${filePath}:`)
      console.error(`   ${find}`)
    } else {
      content = content.replace(find, replace)
    }
  }
  writeFileSync(filePath, content)
  console.log(`✓ Patched ${filePath}`)
}

function copyPackage(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const files = readdirSync(src).filter(f => f !== 'node_modules' && f !== 'dist')
  for (const f of files) {
    cpSync(resolve(src, f), resolve(dest, f), { force: true, recursive: true })
  }
  const srcName = src.split('/').slice(-2).join('/')
  const destName = dest.split('/').slice(-2).join('/')
  console.log(`  ✓ ${srcName} → ${destName}`)
}

// ---- Main ----

console.log('\n📦 Installing Alice-Longbridge patch (workspace packages)...\n')

// ---- Step 1: Copy all Alice-Longbridge packages to OpenAlice/packages/ ----

console.log('🔧 Copying Alice-Longbridge packages to packages/...')

// NOTE: longport-mcp is now merged INTO longport (under mcp/ subdirectory).
// Only copy packages that exist in Alice-Longbridge.
const patchPackages = ['i18n', 'longport', 'opentypebb', 'ibkr']
for (const pkg of patchPackages) {
  const src = resolve(ALICE_PKGS_SRC, pkg)
  const dest = resolve(ROOT, 'packages', pkg)
  if (!existsSync(src)) {
    console.log(`  ⚠ ${pkg} not found in Alice-Longbridge/packages/ — skipping`)
    continue
  }
  copyPackage(src, dest)
}

// ---- Step 2: Apply i18n patches ----

console.log('\n🔧 Applying i18n patches...')
const i18nScript = resolve(ALICE_PKGS_SRC, 'i18n/scripts/apply-patch.mjs')
if (existsSync(i18nScript)) {
  try {
    execSync(`node ${i18nScript}`, { cwd: ROOT, stdio: 'inherit' })
  } catch (e) {
    console.log('⚠ i18n patch script failed — continuing...')
  }
} else {
  console.log('  ⚠ i18n/scripts/apply-patch.mjs not found — skipping')
}

// ---- Step 3: Patch broker registry ----

console.log('\n🔧 Patching broker registry...')
const registryPath = resolve(ROOT, 'src/domain/trading/brokers/registry.ts')
const registryContent = readFileSync(registryPath, 'utf8')

if (registryContent.includes("'longbridge'")) {
  console.log('✓ registry.ts already contains longbridge — skipping')
} else {
  patchFile(registryPath, [
    {
      find: `import { IbkrBroker } from './ibkr/IbkrBroker.js'`,
      replace: `import { IbkrBroker } from './ibkr/IbkrBroker.js'\nimport { LongbridgeBroker } from './longbridge/LongbridgeBroker.js'`,
    },
  ])

  const insertAfter = `  ibkr: {`
  const entry = `  longbridge: {
    configSchema: LongbridgeBroker.configSchema,
    configFields: LongbridgeBroker.configFields,
    fromConfig: LongbridgeBroker.fromConfig,
    name: 'Longbridge (HK/US/SG)',
    description: 'Longbridge — Hong Kong, US, and Singapore equities. Commission-free trading with integrated market data.',
    badge: 'LB',
    badgeColor: 'text-blue-400',
    subtitleFields: [
      { field: 'autoRefresh', label: 'Auto-refresh' },
    ],
    guardCategory: 'securities',
  },
  ibkr: {`

  let content = readFileSync(registryPath, 'utf8')
  writeFileSync(registryPath, content.replace(insertAfter, entry))
  console.log('✓ registry.ts patched')
}

// ---- Step 4: Patch broker index ----

console.log('\n🔧 Patching broker index...')
const indexPath = resolve(ROOT, 'src/domain/trading/brokers/index.ts')
const indexContent = readFileSync(indexPath, 'utf8')

if (indexContent.includes("'./longbridge'") || indexContent.includes('@traderalice/longbridge')) {
  console.log('✓ index.ts already contains longbridge export — skipping')
} else {
  patchFile(indexPath, [
    {
      find: `export { IbkrBroker } from './ibkr/index.js'`,
      replace: `export { IbkrBroker } from './ibkr/index.js'\n\n// Longbridge\nexport { LongbridgeBroker } from './longbridge/LongbridgeBroker.js'\nexport { longbridgeConfigFields } from './longbridge/LongbridgeBroker.js'`,
    },
  ])
}

// ---- Step 5: Install systemd service (auto-start + crash recovery) ----

console.log('\n🔧 Installing systemd service (auto-start + crash recovery)...')

const systemdSrc = resolve(LONGPORT_PKG, 'systemd/openalice.service')
const systemdDest = '/etc/systemd/system/openalice.service'

if (!existsSync(systemdSrc)) {
  console.log('⚠ systemd service file not found — skipping')
} else {
  let serviceContent = readFileSync(systemdSrc, 'utf8')
  serviceContent = serviceContent.replace(/\{\{OPENALICE_ROOT\}\}/g, ROOT)
  // MCP server is now at packages/longport/dist-mcp/index.js (merged into longport package)
  serviceContent = serviceContent.replace(/\{\{LONGBRIDGE_MCP_ROOT\}\}/g, resolve(ROOT, 'packages/longport/dist-mcp'))

  const tmpPath = '/tmp/openalice.service'
  writeFileSync(tmpPath, serviceContent)

  try {
    execSync(`sudo cp ${tmpPath} ${systemdDest}`, { stdio: 'pipe' })
    execSync('sudo systemctl daemon-reload', { stdio: 'pipe' })
    execSync('sudo systemctl enable openalice', { stdio: 'pipe' })
    execSync('sudo systemctl start openalice', { stdio: 'pipe' })
    console.log('✓ systemd service installed')
    console.log('  • Status: sudo systemctl status openalice')
    console.log('  • Logs:   sudo journalctl -u openalice -f')
  } catch (e) {
    console.log('⚠ Could not install systemd service (may need sudo):', e.message)
  }
}

console.log('\n✅ Alice-Longbridge patch applied successfully!\n')
console.log('Next steps:')
console.log('  1. pnpm install                  # install all dependencies')
console.log('  2. pnpm build                    # build everything (broker + MCP)')
console.log('  3. sudo systemctl restart openalice   # reload with new build')
console.log('\n🎉 All done!')

#!/usr/bin/env node
/**
 * Longbridge broker patch uninstaller for OpenAlice.
 *
 * Run from the OpenAlice root directory:
 *   node packages/longport/scripts/remove-patch.mjs
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n')
}

// ---- 1. Remove longbridge files from src/ ----

const longbridgeDir = resolve(ROOT, 'src/domain/trading/brokers/longbridge')
if (existsSync(longbridgeDir)) {
  rmSync(longbridgeDir, { recursive: true, force: true })
  console.log('✓ Removed src/domain/trading/brokers/longbridge/')
}

// ---- 2. Remove longbridge from registry.ts ----

const registryPath = resolve(ROOT, 'src/domain/trading/brokers/registry.ts')
if (existsSync(registryPath)) {
  let content = readFileSync(registryPath, 'utf8')

  // Remove import
  content = content.replace(
    /import \{ LongbridgeBroker \} from '\.\/longbridge\/LongbridgeBroker\.js'\n?/,
    '',
  )

  // Remove registry entry
  content = content.replace(
    /\n  longbridge: \{[\s\S]*?guardCategory: 'securities',\n  \},\n?/,
    '',
  )

  writeFileSync(registryPath, content)
  console.log('✓ registry.ts cleaned')
}

// ---- 3. Remove longbridge from index.ts ----

const indexPath = resolve(ROOT, 'src/domain/trading/brokers/index.ts')
if (existsSync(indexPath)) {
  let content = readFileSync(indexPath, 'utf8')

  content = content.replace(
    /\n\n\/\/ Longbridge\nexport \{ LongbridgeBroker \} from '\.\/longbridge\/LongbridgeBroker\.js'\nexport \{ longbridgeConfigFields \} from '\.\/longbridge\/LongbridgeBroker\.js'\n?/,
    '',
  )

  writeFileSync(indexPath, content)
  console.log('✓ index.ts cleaned')
}

// ---- 4. Remove longbridge from root package.json dependencies ----

const rootPkgPath = resolve(ROOT, 'package.json')
const rootPkg = readJson(rootPkgPath)
if (rootPkg.dependencies?.longbridge) {
  delete rootPkg.dependencies.longbridge
  writeJson(rootPkgPath, rootPkg)
  console.log('✓ package.json cleaned')
}

console.log('\n✅ Longbridge broker patch removed successfully!\n')

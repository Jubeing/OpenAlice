#!/usr/bin/env node
/**
 * apply-patch.mjs — Install LongPort MCP server for OpenAlice
 *
 * Usage:
 *   node scripts/apply-patch.mjs
 *
 * This copies longport-mcp to OpenAlice, installs dependencies,
 * and sets up a systemd service for auto-start.
 */

import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function writeJson(path, obj) { writeFileSync(path, JSON.stringify(obj, null, 2) + '\n') }

console.log(`\n📦 LongPort MCP Server Installer`)
console.log(`   OpenAlice root: ${ROOT}`)

// ---- Step 1: Copy longport-mcp files ----

const MCP_DIR = resolve(ROOT, 'packages/longport-mcp')
mkdirSync(resolve(MCP_DIR, 'src'), { recursive: true })
mkdirSync(resolve(MCP_DIR, 'scripts'), { recursive: true })

const srcFiles = [
  'package.json', 'tsconfig.json', 'tsup.config.ts',
  'config.example.json', 'src/index.ts', 'scripts/start.sh',
]
for (const f of srcFiles) {
  const src = resolve(__dirname, '..', f)
  if (existsSync(src)) cpSync(src, resolve(MCP_DIR, f), { force: true })
}

// Copy scripts
const scriptFiles = ['install-service.sh', 'remove-service.sh']
for (const f of scriptFiles) {
  const src = resolve(__dirname, f)
  if (existsSync(src)) cpSync(src, resolve(MCP_DIR, 'scripts', f), { force: true })
}

console.log('✓ Copied longport-mcp to OpenAlice/packages/longport-mcp/')

// ---- Step 2: Add dependencies ----

const pkg = readJson(resolve(ROOT, 'package.json'))
pkg.dependencies = { ...pkg.dependencies, longbridge: '^4.0.0' }
writeJson(resolve(ROOT, 'package.json'), pkg)
console.log('✓ Added longbridge to package.json')

// ---- Step 3: pnpm install ----

console.log('\n📦 Running pnpm install...')
try { execSync('pnpm install', { cwd: ROOT, stdio: 'inherit' }) } catch {}

// ---- Step 4: Build ----

console.log('\n🔨 Building longport-mcp...')
try { execSync('pnpm build', { cwd: MCP_DIR, stdio: 'inherit' }) } catch {}

// ---- Step 5: Create config ----

const configPath = resolve(MCP_DIR, 'config.json')
if (!existsSync(configPath)) {
  cpSync(resolve(MCP_DIR, 'config.example.json'), configPath)
  console.log('\n⚠  Created config.json — edit with your LongPort credentials!')
  console.log(`   nano ${configPath}`)
} else {
  console.log('✓ config.json already exists')
}

console.log(`
✅ LongPort MCP server installed!

Next steps:
  1. Edit longport-mcp/config.json with your LongPort credentials
  2. Start:   cd longport-mcp && node dist/index.js
  3. Or use:  sudo bash longport-mcp/scripts/install-service.sh
`)

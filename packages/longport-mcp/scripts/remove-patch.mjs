#!/usr/bin/env node
/**
 * remove-patch.mjs — Remove LongPort MCP server from OpenAlice
 *
 * Usage:
 *   node scripts/remove-patch.mjs
 */

import { existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()
const MCP_DIR = resolve(ROOT, 'longport-mcp')

// Stop service
try {
  const { execSync } = await import('child_process')
  execSync('sudo systemctl stop longport-mcp 2>/dev/null || true', { stdio: 'pipe' })
  execSync('sudo systemctl disable longport-mcp 2>/dev/null || true', { stdio: 'pipe' })
  execSync('sudo rm -f /etc/systemd/system/longport-mcp.service', { stdio: 'pipe' })
  console.log('✓ Stopped and disabled systemd service')
} catch {}

// Remove directory
if (existsSync(MCP_DIR)) {
  rmSync(MCP_DIR, { recursive: true, force: true })
  console.log('✓ Removed longport-mcp/')
}

console.log('\n✅ LongPort MCP server removed.')

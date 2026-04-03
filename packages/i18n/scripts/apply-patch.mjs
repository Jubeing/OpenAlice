#!/usr/bin/env node
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

function patch(file, patchFile) {
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
patch('main.tsx', '0001-main-tsx.patch')
patch('Sidebar.tsx', '0002-Sidebar-tsx.patch')
patch('SettingsPage.tsx', '0003-SettingsPage-tsx.patch')
patch('DevPage.tsx', '0004-DevPage-tsx.patch')

// Copy new i18n files
console.log('Copying i18n files...')
execSync(`cp ${resolve(__dirname, '../en.ts')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })
execSync(`cp ${resolve(__dirname, '../zh.ts')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })
execSync(`cp ${resolve(__dirname, '../index.tsx')} ${ROOT}/ui/src/i18n/`, { stdio: 'inherit' })

console.log('✅ i18n patch applied successfully')
console.log('Run: pnpm build:ui')

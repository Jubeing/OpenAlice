#!/usr/bin/env node
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

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
unpatch('0004-DevPage-tsx.patch')
unpatch('0003-SettingsPage-tsx.patch')
unpatch('0002-Sidebar-tsx.patch')
unpatch('0001-main-tsx.patch')

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

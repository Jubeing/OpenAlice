import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: ['longbridge', '@modelcontextprotocol/sdk'],
})

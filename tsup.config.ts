import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  target: 'node20',
  external: ['longbridge', 'sharp'],
})

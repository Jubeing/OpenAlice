import { defineConfig } from 'tsup'

// MCP server build only — the broker source (src/) is copied to
// src/domain/trading/brokers/longbridge/ and built as part of
// the main OpenAlice build (pnpm build:backend).
export default defineConfig({
  entry: ['mcp/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: ['longbridge', '@modelcontextprotocol/sdk'],
  outDir: 'dist-mcp',
})

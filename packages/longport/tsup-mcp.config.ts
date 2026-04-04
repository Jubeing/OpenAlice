import { defineConfig } from 'tsup'

// MCP server only build
export default defineConfig({
  entry: ['mcp/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: ['longbridge', '@modelcontextprotocol/sdk'],
  outDir: 'dist-mcp',
})

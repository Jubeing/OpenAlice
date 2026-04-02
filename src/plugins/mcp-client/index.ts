import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { tool, type Tool } from "ai";
import { z } from "zod";
import type { Plugin, EngineContext } from "../../core/types.js";
import { zToJsonSchema } from "zod-to-json-schema"; // need to check if available, otherwise just mapping

// Helper to convert MCP JSON schema to Zod, rough approximation
// For simplicity, we can pass any to MCP
const mcpToZod = (schema: any) => {
  if (!schema) return z.object({});
  // If it's complex, we just use a loose Zod schema and let MCP handle validation
  return z.record(z.string(), z.any());
};

export class McpClientPlugin implements Plugin {
  name = "mcp-client";
  private clients: Map<string, Client> = new Map();
  private toolCenter: any;

  constructor(private mcpServers: Record<string, string>) {}

  async start(ctx: EngineContext): Promise<void> {
    this.toolCenter = ctx.toolCenter;
    
    for (const [serverId, url] of Object.entries(this.mcpServers)) {
      try {
        const transport = new SSEClientTransport(new URL(url + "/sse"));
        const client = new Client({ name: "open-alice-client", version: "1.0.0" });
        await client.connect(transport);
        this.clients.set(serverId, client);
        
        console.log(`[mcp-client] connected to ${serverId} at ${url}`);
        
        const toolsRes = await client.listTools();
        const aiTools: Record<string, Tool> = {};
        
        for (const t of toolsRes.tools) {
          const toolName = `mcp__${serverId}__${t.name}`;
          
          aiTools[toolName] = tool({
            description: `[MCP: ${serverId}] ${t.description || t.name}`,
            inputSchema: z.record(z.string(), z.any()).describe("JSON arguments for the MCP tool"),
            execute: async (args: any) => {
              try {
                const res = await client.callTool({
                  name: t.name,
                  arguments: args
                });
                return res.content;
              } catch (e: any) {
                return { error: e.message };
              }
            }
          });
        }
        
        ctx.toolCenter.register(aiTools, `mcp-client-${serverId}`);
        console.log(`[mcp-client] registered ${toolsRes.tools.length} tools for ${serverId}`);
      } catch (err: any) {
        console.error(`[mcp-client] failed to connect to ${serverId}: ${err.message}`);
      }
    }
  }

  async stop(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch (e) {}
    }
    this.clients.clear();
  }
}

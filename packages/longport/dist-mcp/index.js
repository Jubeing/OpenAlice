// mcp/index.ts
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
var __dirname = dirname(fileURLToPath(import.meta.url));
function loadConfig() {
  const configPath = resolve(__dirname, "../config.json");
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, "utf8"));
  }
  return {
    appKey: process.env.LONGPORT_APP_KEY ?? "",
    appSecret: process.env.LONGPORT_APP_SECRET ?? "",
    accessToken: process.env.LONGPORT_ACCESS_TOKEN ?? "",
    paper: process.env.LONGPORT_PAPER === "true",
    port: parseInt(process.env.LONGPORT_MCP_PORT ?? "3004")
  };
}
var _tradeCtx = null;
var _quoteCtx = null;
async function getTradeCtx() {
  if (_tradeCtx) return _tradeCtx;
  const { Config, TradeContext } = await import("longbridge");
  const config = loadConfig();
  const cfg = Config.fromApikey(config.appKey, config.appSecret, config.accessToken);
  _tradeCtx = TradeContext.new(cfg);
  return _tradeCtx;
}
async function getQuoteCtx() {
  if (_quoteCtx) return _quoteCtx;
  const { Config, QuoteContext } = await import("longbridge");
  const config = loadConfig();
  const cfg = Config.fromApikey(config.appKey, config.appSecret, config.accessToken);
  _quoteCtx = QuoteContext.new(cfg);
  return _quoteCtx;
}
function mcpContent(result) {
  if (result == null) return [{ type: "text", text: "OK" }];
  if (typeof result === "string") return [{ type: "text", text: result }];
  return [{ type: "text", text: JSON.stringify(result, null, 2) }];
}
function errResult(msg) {
  return { content: [{ type: "text", text: msg }], isError: true };
}
async function main() {
  const config = loadConfig();
  if (!config.appKey || !config.appSecret || !config.accessToken) {
    console.error("\u274C Missing LongPort credentials.");
    console.error("   Edit config.json or set LONGPORT_APP_KEY / LONGPORT_APP_SECRET / LONGPORT_ACCESS_TOKEN env vars.");
    process.exit(1);
  }
  const transport = new StreamableHTTPServerTransport({ port: config.port });
  const mcp = new McpServer({ name: "longport", version: "0.1.0" });
  mcp.registerTool("get_account", {
    description: "Get LongPort account balances \u2014 net assets, cash, and buying power across all currencies.",
    inputSchema: z.object({})
  }, async () => {
    try {
      const ctx = await getTradeCtx();
      const balances = await ctx.accountBalance();
      return { content: mcpContent({ balances }) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("get_positions", {
    description: "Get current stock positions \u2014 symbol, quantity, avg cost, market value, unrealized P&L.",
    inputSchema: z.object({})
  }, async () => {
    try {
      const ctx = await getTradeCtx();
      const positions = await ctx.accountPositions();
      return { content: mcpContent({ positions }) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("get_orders", {
    description: "Get all orders submitted today.",
    inputSchema: z.object({})
  }, async () => {
    try {
      const ctx = await getTradeCtx();
      const orders = await ctx.todayOrders();
      return { content: mcpContent({ orders }) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("get_order_detail", {
    description: "Get detailed information about a specific order by its order ID.",
    inputSchema: z.object({
      orderId: z.string().describe("The order ID to query")
    })
  }, async (args) => {
    try {
      const ctx = await getTradeCtx();
      const detail = await ctx.orderDetail(args.orderId);
      return { content: mcpContent(detail) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("place_order", {
    description: 'Submit a new order. Symbol examples: "AAPL.US" (US), "700.HK" (HK), "D05.SI" (SG).',
    inputSchema: z.object({
      symbol: z.string().describe('Symbol, e.g. "AAPL.US", "700.HK"'),
      side: z.enum(["Buy", "Sell"]).describe("Buy or Sell"),
      quantity: z.number().int().positive().describe("Number of shares"),
      orderType: z.enum(["MO", "LO", "LIT", "ELO"]).optional().describe("MO=Market, LO=Limit, LIT=Stop, ELO=StopLimit"),
      price: z.number().positive().optional().describe("Limit price (required for LO, ELO)"),
      timeInForce: z.enum(["Day", "GTC", "GTD", "IOC", "FOK"]).optional().describe("Time in force")
    })
  }, async (args) => {
    try {
      const { Config, TradeContext, Decimal, OrderType, OrderSide, TimeInForceType } = await import("longbridge");
      const ctx = await getTradeCtx();
      const orderTypeMap = {
        MO: OrderType.MO,
        LO: OrderType.LO,
        LIT: OrderType.LIT,
        ELO: OrderType.ELO
      };
      const tifMap = {
        Day: TimeInForceType.Day,
        GTC: TimeInForceType.GoodTilCanceled,
        GTD: TimeInForceType.GoodTilDate,
        IOC: TimeInForceType.IOC,
        FOK: TimeInForceType.FOK
      };
      const resp = await ctx.submitOrder({
        symbol: args.symbol,
        orderType: orderTypeMap[args.orderType ?? "MO"],
        side: args.side === "Buy" ? OrderSide.Buy : OrderSide.Sell,
        timeInForce: tifMap[args.timeInForce ?? "Day"],
        submittedPrice: args.price != null ? new Decimal(String(args.price)) : void 0,
        submittedQuantity: new Decimal(String(args.quantity))
      });
      return { content: mcpContent(resp) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("cancel_order", {
    description: "Cancel a pending order by its order ID.",
    inputSchema: z.object({
      orderId: z.string().describe("The order ID to cancel")
    })
  }, async (args) => {
    try {
      const ctx = await getTradeCtx();
      await ctx.cancelOrder(args.orderId);
      return { content: mcpContent({ message: `Order ${args.orderId} cancelled.` }) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("get_quote", {
    description: "Get real-time quote \u2014 last price, bid/ask, volume, high/low for a symbol.",
    inputSchema: z.object({
      symbol: z.string().describe('Symbol, e.g. "AAPL.US", "700.HK"')
    })
  }, async (args) => {
    try {
      const ctx = await getQuoteCtx();
      const quotes = await ctx.quote([args.symbol]);
      if (!quotes.length) return errResult("No quote data found.");
      return { content: mcpContent(quotes[0]) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("search_symbols", {
    description: "Search for securities by keyword (symbol or company name).",
    inputSchema: z.object({
      keyword: z.string().describe("Search keyword"),
      exchange: z.string().optional().describe('Exchange filter: "HK", "US", "SG"'),
      limit: z.number().int().positive().max(100).optional().describe("Max results (default 20)")
    })
  }, async (args) => {
    try {
      const ctx = await getQuoteCtx();
      const results = await ctx.searchSymbol(args.keyword);
      const filtered = args.exchange ? results.filter((r) => r.exchange?.toUpperCase() === args.exchange?.toUpperCase()) : results;
      return { content: mcpContent({ results: filtered.slice(0, args.limit ?? 20) }) };
    } catch (err) {
      return errResult(String(err));
    }
  });
  mcp.registerTool("get_market_clock", {
    description: "Get US market open/close status and next open/close timestamps.",
    inputSchema: z.object({})
  }, async () => {
    const now = /* @__PURE__ */ new Date();
    const totalMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    const isOpen = isWeekday && totalMins >= 870 && totalMins < 1260;
    if (isOpen) {
      const nextClose = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21, 0));
      return { content: mcpContent({ isOpen: true, nextClose: nextClose.toISOString() }) };
    } else if (totalMins < 870) {
      const nextOpen = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 30));
      return { content: mcpContent({ isOpen: false, nextOpen: nextOpen.toISOString() }) };
    } else {
      const daysUntilOpen = now.getUTCDay() === 5 ? 3 : 1;
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilOpen, 14, 30));
      return { content: mcpContent({ isOpen: false, nextOpen: next.toISOString() }) };
    }
  });
  await mcp.connect(transport);
  const server = http.createServer((req, res) => {
    transport.handleRequest(req, res);
  });
  await new Promise((resolve2, reject) => {
    server.on("error", reject);
    server.listen(config.port, "0.0.0.0", resolve2);
  });
  console.log(`\u2705 LongPort MCP server running on http://0.0.0.0:${config.port}/mcp`);
  console.log(`   APP_KEY: ${config.appKey.slice(0, 8)}... | PAPER: ${config.paper}`);
  setInterval(() => {
  }, 6e4);
}
main().catch(console.error);
//# sourceMappingURL=index.js.map
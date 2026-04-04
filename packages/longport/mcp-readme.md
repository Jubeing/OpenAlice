# LongPort MCP Server

A standalone MCP (Model Context Protocol) server that exposes **LongBridge OpenAPI** as MCP tools. This allows any MCP client to call LongPort trading and quote functions using the standard MCP protocol.

## Features

- **8 MCP tools**: `get_account`, `get_positions`, `get_orders`, `get_order_detail`, `place_order`, `cancel_order`, `get_quote`, `search_symbols`, `get_market_clock`
- **MCP standard**: Compatible with any MCP client (Claude Desktop, OpenClaw, etc.)
- **HTTP transport**: Streamable HTTP, works behind reverse proxies
- **Easy config**: JSON config file or environment variables

## Requirements

- Node.js 20+
- LongPort OpenAPI credentials (App Key, App Secret, Access Token)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure credentials
cp config.example.json config.json
# Edit config.json with your LongPort credentials

# 3. Start the server
node dist/index.js

# Server runs on http://localhost:3004/mcp
```

## Configuration

Edit `config.json`:

```json
{
  "appKey": "your-app-key",
  "appSecret": "your-app-secret",
  "accessToken": "your-access-token",
  "paper": true,
  "port": 3004
}
```

Or use environment variables:

```bash
LONGPORT_APP_KEY=xxx LONGPORT_APP_SECRET=xxx LONGPORT_ACCESS_TOKEN=xxx LONGPORT_PAPER=true node dist/index.js
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_account` | Account balances — net assets, cash, buying power |
| `get_positions` | Current positions — quantity, cost, market value, P&L |
| `get_orders` | All orders submitted today |
| `get_order_detail` | Detailed info for a specific order |
| `place_order` | Submit a new order (Market, Limit, Stop, Stop-Limit) |
| `cancel_order` | Cancel a pending order |
| `get_quote` | Real-time quote — last, bid/ask, volume, high/low |
| `search_symbols` | Search securities by keyword |
| `get_market_clock` | US market open/close status |

## Symbol Format

Use the LongPort unified format:
- US: `"AAPL.US"`, `"TSLA.US"`, `"NVDA.US"`
- HK: `"700.HK"`, `"9988.HK"`
- SG: `"D05.SI"`, `"OLAM.SI"`

## Systemd Service (Linux)

```bash
# Install as systemd service (requires sudo)
sudo bash scripts/install-service.sh

# Check status
sudo systemctl status longport-mcp

# View logs
journalctl -u longport-mcp -f
```

## OpenAlice Integration

To use with OpenAlice as an MCP client:

1. Install this MCP server
2. Configure OpenAlice's MCP plugins to connect to `http://localhost:3004/mcp`

Or merge the LongPort broker into OpenAlice directly via:
```bash
node apply-patch.mjs
```

## Uninstall

```bash
# Stop and remove systemd service
sudo bash scripts/remove-service.sh

# Remove files
rm -rf longport-mcp/
```

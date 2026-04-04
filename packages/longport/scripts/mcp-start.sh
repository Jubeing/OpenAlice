#!/usr/bin/env bash
# start.sh — Start LongPort MCP server

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT="$(dirname "$MCP_DIR")"

export NODE_PATH="$ROOT/node_modules"

echo "Starting LongPort MCP server..."
cd "$MCP_DIR"
exec node dist/index.js

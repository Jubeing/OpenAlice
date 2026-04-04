#!/usr/bin/env bash
# install-service.sh — Install LongPort MCP server as systemd service

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$MCP_DIR")"
SERVICE_NAME="longport-mcp"

echo "Installing $SERVICE_NAME as systemd service..."

# Create systemd unit
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<EOF
[Unit]
Description=LongPort MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$MCP_DIR
Environment=NODE_PATH=$ROOT_DIR/node_modules
ExecStart=$ROOT_DIR/node_modules/.bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
echo "✅ $SERVICE_NAME installed and started"
sudo systemctl status "$SERVICE_NAME" --no-pager

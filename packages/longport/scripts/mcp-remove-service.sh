#!/usr/bin/env bash
# remove-service.sh — Remove LongPort MCP systemd service

set -e

SERVICE_NAME="longport-mcp"
echo "Removing $SERVICE_NAME systemd service..."

sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"
sudo systemctl daemon-reload
echo "✅ $SERVICE_NAME removed"

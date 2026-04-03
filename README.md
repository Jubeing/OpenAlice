# Alice-Longbridge

Longbridge broker integration patch for OpenAlice.

## 安装方式

```bash
# 1. 克隆 OpenAlice
git clone https://github.com/TraderAlice/OpenAlice.git
cd OpenAlice

# 2. 复制 Longbridge 补丁包
cp -r Alice-Longbridge/packages/longport packages/

# 3. 应用补丁（自动安装 systemd 服务 → 开机自启 + 崩溃自恢复）
node packages/longport/scripts/apply-patch.mjs

# 4. 安装依赖 + 构建
pnpm install
pnpm build:backend && pnpm build:ui

# 5. 重载新构建
sudo systemctl restart openalice
```

> 应用补丁后 OpenAlice 会自动启动，并注册为 systemd 服务，开机自动运行、崩溃自动恢复。

## 补丁包结构

```
packages/longport/
├── src/                    # Broker 源码
├── systemd/
│   └── openalice.service   # systemd 服务（开机自启 + 崩溃自恢复）
├── scripts/
│   ├── apply-patch.mjs     # 安装补丁
│   ├── remove-patch.mjs   # 卸载补丁
│   └── refresh-token.mjs   # Token 刷新脚本
├── package.json
└── README.md
```

## systemd 服务

- 服务名: `openalice`
- 状态: `sudo systemctl status openalice`
- 日志: `sudo journalctl -u openalice -f`
- 重启: `sudo systemctl restart openalice`
- 停止: `sudo systemctl stop openalice`

## 功能

- 市场: 香港 (SEHK)、美国 (NASDAQ/NYSE)、新加坡 (SGX)
- 订单类型: 市价单、限价单、止损单、止损限价单
- 自动刷新 Token: 使用 HMAC-SHA256 自动续期
- 动态 UI: 在 OpenAlice 交易页面自动显示 Longbridge

## Token 设置

### 手动 Token
1. 进入 Trading → New Account → Platform → Longbridge
2. 填入 App Key、App Secret、Access Token
3. 关闭 Auto-refresh Token（默认）

### 自动刷新 Token（推荐）
Access Token 约 90 天过期。开启自动刷新后，系统会使用 HMAC-SHA256 自动续期。

1. 开启 Auto-refresh Token
2. 设置 cron 任务：0 4 1 * * cd /path/to/OpenAlice && node packages/longport/scripts/refresh-token.mjs

## 卸载
node packages/longport/scripts/remove-patch.mjs
pnpm build:backend && pnpm build:ui

## 依赖
- Node.js 20+
- pnpm
- Longbridge OpenAPI 账号: https://open.longbridge.com/en/

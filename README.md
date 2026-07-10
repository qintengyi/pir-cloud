# pir-cloud

红外人体感应云端报警管理系统 — 基于 ESP8266 PIR 传感器 + Node.js 后端 + React 前端的物联网人体感应解决方案。

支持多用户激活码商业模式：管理员生成激活码 → 用户购买激活码绑定设备 → 设备上报人体感应事件 → 邮件/QQ Bot 推送告警通知。

## 功能特性

### 设备管理
- ESP8266 PIR 传感器接入，支持设备绑定/解绑
- 心跳保活机制，自动检测设备上下线
- 设备配置：防抖间隔、通知渠道、持续在线提醒、稳定后推送模式
- Web 端 ESP8266 固件刷写（esptool-js）

### 通知系统
- **邮件通知**：基于 Nodemailer，支持 HTML 模板
- **QQ Bot 通知**：基于 OneBot WebSocket，实时推送消息
- **稳定后推送模式**：设备上线后需静置 3 分钟预热，期间屏蔽"有人"告警，预热完成后推送通知
- **持续在线提醒**：设备持续在线超过设定时间后周期性提醒

### 用户系统
- 邮箱注册/登录，JWT 双 Token 认证（Access + Refresh）
- Cloudflare Turnstile 人机验证
- 会员等级（免费/高级），激活码绑定设备
- QQ 归属验证（向机器人发验证码确认身份）

### 管理后台
- 用户管理、激活码批量生成与管理
- 系统配置（SMTP、OneBot 等）在线编辑
- 固件版本管理（OTA 升级）
- 订单管理
- 数据统计仪表盘

### 告警与事件
- 事件类型：上线 / 下线 / 告警（有人/无人/预热完成）
- 防抖机制：可配置间隔，避免频繁告警
- 事件历史记录与查询

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Fastify + Prisma ORM + MySQL 8.0 |
| 前端 | React 18 + Vite 5 + MUI 5 + Tailwind CSS |
| 认证 | JWT (Access + Refresh) + bcryptjs |
| 人机验证 | Cloudflare Turnstile |
| 通知 | Nodemailer (邮件) + OneBot WebSocket (QQ Bot) |
| 固件刷写 | esptool-js (Web 端串口刷写) |
| 测试 | Vitest + Supertest |

## 项目结构

```
pir-cloud/
├── server/                    # 后端
│   ├── prisma/
│   │   ├── schema.prisma      # 数据库 Schema（11 个模型）
│   │   └── seed.ts            # 超级管理员初始化脚本
│   ├── src/
│   │   ├── config/            # Fastify / Prisma / 环境配置
│   │   ├── middlewares/       # 认证 / 管理员 / 限流 / Turnstile 中间件
│   │   ├── modules/
│   │   │   ├── auth/          # 注册 / 登录 / Token 刷新
│   │   │   ├── device/        # 设备绑定 / 配置 / 详情
│   │   │   ├── report/        # 设备上报处理（含稳定后推送预热逻辑）
│   │   │   ├── notification/  # 通知分发 / 防抖 / 邮件 / OneBot
│   │   │   ├── alarm/         # 告警事件查询
│   │   │   ├── firmware/      # 固件版本管理 / OTA
│   │   │   ├── payment/       # 订单 / 支付
│   │   │   ├── qq-verify/     # QQ 归属验证
│   │   │   ├── user/          # 用户资料 / 会员
│   │   │   └── admin/         # 管理后台（激活码/固件/订单/用户/设置）
│   │   ├── jobs/              # 定时任务（心跳检测 / 数据清理 / 在线提醒）
│   │   ├── types/             # TypeScript 类型定义
│   │   └── utils/             # 工具函数（JWT / bcrypt / crypto / logger）
│   ├── tests/                 # 单元测试 + 集成测试
│   ├── deploy/                # 部署文档 + Nginx 配置示例
│   └── .env.example           # 环境变量模板
├── web/                       # 前端
│   ├── src/
│   │   ├── api/               # API 请求层（axios）
│   │   ├── components/        # 通用组件 / 设备 / 固件刷写
│   │   ├── pages/
│   │   │   ├── auth/          # 登录 / 注册 / 忘记密码
│   │   │   ├── dashboard/     # 用户仪表盘
│   │   │   ├── devices/       # 设备管理 / 设备详情
│   │   │   ├── alarms/        # 告警历史
│   │   │   ├── notifications/ # 通知配置
│   │   │   ├── flash/         # Web 端固件刷写
│   │   │   ├── profile/       # 个人资料 / 会员升级
│   │   │   └── admin/         # 管理后台页面
│   │   ├── hooks/             # React Query 自定义 Hooks
│   │   ├── store/             # Zustand 状态管理
│   │   └── utils/             # 工具函数
│   └── .env.example           # 前端环境变量模板
└── .gitignore
```

## 快速开始（开发环境）

### 前置要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- npm 或 pnpm

### 1. 克隆仓库
```bash
git clone https://github.com/qintengyi/pir-cloud.git
cd pir-cloud
```

### 2. 启动后端
```bash
cd server
cp .env.example .env
# 编辑 .env，配置 DATABASE_URL、JWT 密钥等
npm install
npx prisma generate
npx prisma migrate dev
npm run seed    # 初始化超级管理员
npm run dev
```
后端默认运行在 `http://localhost:10310`

### 3. 启动前端
```bash
cd web
cp .env.example .env.local
# 编辑 .env.local，配置 VITE_API_BASE_URL 和 Turnstile Site Key
npm install
npm run dev
```
前端默认运行在 `http://localhost:5173`

### 4. 运行测试
```bash
cd server
npm test
```

## 生产部署

### 环境要求
- Node.js >= 18.0.0（推荐使用 LTS）
- MySQL >= 8.0
- Nginx（反向代理 + HTTPS）
- PM2 或宝塔面板（进程管理）

### 后端部署
```bash
cd server
npm install
npm run build          # 编译 TypeScript

# 配置环境变量
cp .env.example .env
vim .env               # 修改 DATABASE_URL、JWT 密钥、SMTP 等

# 数据库初始化
npx prisma generate
npx prisma migrate deploy   # 或 npx prisma db push（无 migrations 目录时）
npm run seed

# 启动（PM2 方式）
pm2 start dist/app.js --name pir-cloud-server
pm2 save && pm2 startup

# 或直接运行
node dist/app.js
```

### 前端部署
```bash
cd web
npm install
npm run build          # 产物在 dist/
# 将 dist/ 部署到 Nginx 静态目录
```

### Nginx 配置
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态资源
    root /var/www/pir-cloud/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:10310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 固件 OTA 目录
```bash
# 在 .env 中配置固件存储目录
FIRMWARE_STORE_DIR=/path/to/firmware_store
FIRMWARE_MAX_SIZE=4194304   # 4MB
```

## 配置说明

### 后端环境变量（server/.env）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | development |
| `PORT` | 后端端口 | 10310 |
| `DATABASE_URL` | MySQL 连接字符串 | — |
| `JWT_ACCESS_SECRET` | Access Token 密钥 | — |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 | — |
| `JWT_ACCESS_EXPIRES` | Access Token 有效期 | 15m |
| `JWT_REFRESH_EXPIRES` | Refresh Token 有效期 | 7d |
| `BCRYPT_SALT_ROUNDS` | bcrypt 加密轮数 | 10 |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile Site Key | — |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile Secret Key | — |
| `HEARTBEAT_TIMEOUT_SECONDS` | 心跳超时秒数 | 300 |
| `DATA_RETENTION_DAYS` | 数据保留天数 | 90 |
| `SEED_ADMIN_EMAIL` | 超级管理员邮箱 | — |
| `SEED_ADMIN_PASSWORD` | 超级管理员密码 | — |
| `ONEBOT_WS_URL` | OneBot WebSocket 地址 | — |
| `ONEBOT_TOKEN` | OneBot Access Token | — |
| `FIRMWARE_STORE_DIR` | 固件存储目录 | ./firmware_store |
| `FIRMWARE_MAX_SIZE` | 固件大小上限（字节） | 4194304 |
| `RATE_LIMIT_AUTH` | 认证接口限流 | 5 |
| `RATE_LIMIT_REPORT` | 上报接口限流 | 60 |

### 前端环境变量（web/.env.local）

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 后端 API 地址 |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile Site Key |

### 管理后台在线配置
SMTP 邮件、OneBot WebSocket 等参数支持在管理后台 → 系统设置页面在线修改，无需重启服务。

## 数据库模型

| 模型 | 说明 |
|------|------|
| User | 用户（普通用户/管理员，会员等级） |
| RefreshToken | 刷新令牌 |
| ActivationCode | 激活码（unused/bound/disabled） |
| Device | 设备（绑定用户+激活码，在线状态） |
| DeviceConfig | 设备配置（通知/防抖/在线提醒/稳定后推送） |
| Event | 事件记录（上线/下线/告警） |
| Order | 订单（pending/paid/cancelled/refunded） |
| SystemConfig | 系统配置（键值对，支持 JSON） |
| VerificationCode | 邮箱验证码（注册/重置密码） |
| FirmwareVersion | 固件版本（OTA） |
| QqVerification | QQ 归属验证记录 |

## 稳定后推送模式

设备配置中的"稳定后推送模式"用于减少误报：

1. **开启后**：设备上线照常推送在线通知
2. **预热阶段**：设备上报"有人"时被屏蔽，显示"正在预热，已屏蔽推送"。每次上报"无人"刷新预热计时
3. **预热完成**：连续 3 分钟无"无人"上报后，预热完成，推送"预热完成"通知
4. **正常推送**：预热完成后恢复正常"有人"告警推送

> 使用建议：开启前确保传感器前方无人，静置 3 分钟完成预热。

## 注意事项

1. **安全配置**：生产环境务必修改 `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET` 为强随机字符串，切勿使用 `.env.example` 中的默认值。
2. **敏感文件**：`.env` 文件已在 `.gitignore` 中排除，切勿提交真实配置到版本库。
3. **数据库迁移**：本项目无 Prisma migrations 目录，schema 变更使用 `npx prisma db push`（直接同步库结构 + 重新生成 Client）。如需正式迁移流程，使用 `npx prisma migrate dev --name <name>`。
4. **CORS**：生产环境在 `.env` 中配置允许的前端域名，不要使用 `*`。
5. **HTTPS**：生产环境必须启用 HTTPS，Nginx 配置强制 HTTP 跳转。
6. **固件刷写**：Web 端刷写功能需要浏览器支持 Web Serial API（Chrome/Edge 89+）。
7. **QQ Bot**：需自行部署 OneBot 实现（如 go-cqhttp / Lagrange.Core），配置 WebSocket 反向连接地址。
8. **备份**：建议定期备份 MySQL 数据库，可使用 crontab + mysqldump 自动化。

## 相关仓库

- [pir-cloud-firmware](https://github.com/qintengyi/pir-cloud-firmware) — ESP8266 固件 + Windows 刷写工具

## License

MIT

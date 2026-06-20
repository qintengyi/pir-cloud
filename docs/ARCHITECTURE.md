# pir-cloud — 系统架构设计文档

| 字段 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 编写人 | 架构师 高见远（Gao） |
| 日期 | 2025-01-20 |
| 语言 | 简体中文 |
| 项目名称 | pir-cloud-panel |
| 技术栈 | 后端 Node.js + TypeScript + Fastify + Prisma / 数据库 MySQL / 前端 React + Vite + Tailwind CSS + MUI |

---

## 目录

1. [实现方案与框架选型](#1-实现方案与框架选型)
2. [项目目录结构](#2-项目目录结构)
3. [数据库设计](#3-数据库设计)
4. [接口规范](#4-接口规范)
5. [核心数据结构（类图）](#5-核心数据结构类图)
6. [程序调用流程（时序图）](#6-程序调用流程时序图)
7. [任务列表](#7-任务列表)
8. [依赖包列表](#8-依赖包列表)
9. [共享知识（跨文件约定）](#9-共享知识跨文件约定)
10. [待明确事项](#10-待明确事项)

---

## 1. 实现方案与框架选型

### 1.1 核心技术挑战

| 挑战 | 说明 | 应对方案 |
|------|------|---------|
| 设备上报安全 | 激活码明文传输存在被抓包风险 | HTTPS 部署 + 激活码绑定后生成 device_token，后续上报使用 token 鉴权 |
| 告警防抖去重 | 红外感应可能频繁触发误报，导致消息轰炸 | 服务端防抖窗口机制（默认 30s），用户可按设备独立配置 |
| 告警实时性 | 端到端延迟 ≤ 5s | 上报接口同步处理 + 通知推送异步化（setImmediate 异步发送，不阻塞响应） |
| 高并发上报 | 大量设备同时上报可能压垮服务端 | 上报接口限流 + 防抖前置过滤 + Prisma 连接池配置 |
| 邮件送达率 | 免费用户核心通知渠道 | nodemailer + SMTP 重试机制（最多 3 次，指数退避）+ SPF/DKIM 配置 |
| OneBot 稳定性 | QQ 机器人依赖第三方客户端，可能不稳定 | WebSocket 长连接 + 自动重连 + 降级到邮箱通知 + 日志记录 |
| 设备离线检测 | 需要准确判断设备在线状态 | 心跳机制（60s 一次）+ 定时任务扫描（5min 阈值）+ 状态变化写事件日志 |
| 数据清理 | 事件日志无限增长 | node-cron 定时任务每日凌晨清理超过 90 天的数据 |

### 1.2 后端框架选型

| 组件 | 选型 | 理由 |
|------|------|------|
| **Web 框架** | Fastify | 性能优异（比 Express 快 2-3 倍）；内置 JSON Schema 参数校验；插件体系成熟；原生支持 TypeScript；内置 Pino 日志 |
| **ORM** | Prisma | 类型安全（自动生成 TypeScript 类型）；声明式 schema 即文档；迁移管理完善；MySQL 支持成熟；IDE 自动补全体验优秀 |
| **数据库** | MySQL | 已确认；成熟稳定；Prisma 原生支持；裸机部署简单 |
| **认证** | JWT (access_token + refresh_token) | 无状态认证，水平扩展友好；access_token 短期有效（15min）减少泄露风险；refresh_token 长期有效（7d）存储于 DB 可主动失效 |
| **参数校验** | Fastify JSON Schema + Ajv | Fastify 内置，无需额外引入；自动生成 TypeScript 类型；校验与文档一体化 |
| **邮件发送** | nodemailer | Node.js 生态最成熟的邮件库；支持 SMTP/SES 等多种传输方式；支持 HTML 模板 |
| **QQ 机器人** | OneBot v11 WebSocket | 平台自建单实例，所有付费用户共享；按用户绑定的 QQ 号分发消息；WebSocket 长连接 + 自动重连 |
| **定时任务** | node-cron | 轻量级 cron 表达式调度；无外部依赖；适合裸机部署 |
| **密码哈希** | bcrypt | 行业标准；salt rounds ≥ 10；Prisma 层不涉及，在 service 层处理 |
| **日志** | Pino (Fastify 内置) | 高性能 JSON 日志；结构化输出便于 ELK 采集 |
| **进程管理** | PM2 | 裸机部署进程守护；自动重启；日志管理；零停机重载 |
| **反向代理** | Nginx | HTTPS 终结；静态文件服务；负载均衡；Let's Encrypt 证书 |

### 1.3 前端框架选型

| 组件 | 选型 | 理由 |
|------|------|------|
| **构建工具** | Vite | 极速 HMR；原生 ES Module；Rollup 打包；TypeScript 原生支持 |
| **UI 框架** | React 18 | 生态成熟；Hooks 模式简洁；已确认 |
| **组件库** | MUI (Material-UI) | 组件丰富；主题定制能力强；与 Tailwind 共存无冲突；PRD 明确要求使用 MUI TextField 等组件 |
| **CSS 方案** | Tailwind CSS | 原子化 CSS，开发效率高；与 MUI 共存（Tailwind 负责布局/间距，MUI 负责组件）；已确认 |
| **路由** | React Router v6 | React 生态标准路由；嵌套路由；loader/action 模式 |
| **HTTP 客户端** | axios | 拦截器机制优雅处理 token 刷新；请求/响应转换；取消请求 |
| **服务端状态** | TanStack Query (React Query) | 缓存/重试/轮询/乐观更新；与 axios 配合完美；减少手动状态管理 |
| **客户端状态** | Zustand | 轻量级（< 1KB）；无 Provider 嵌套；适合管理 auth 状态、UI 状态 |
| **表单管理** | react-hook-form + zod | 性能优秀（非受控）；zod schema 可前后端共享校验逻辑 |
| **图表** | Recharts (P2) | React 原生图表库；声明式 API；满足告警趋势图需求 |

### 1.4 架构模式

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (反向代理 + SSL)                     │
│                    ├─ /api/* → Fastify Backend                   │
│                    └─ /* → Vite Build Static Files               │
├─────────────────────────────────────────────────────────────────┤
│                    Fastify Backend (PM2 守护)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Auth     │  │ Device   │  │ Report   │  │ Alarm    │        │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │              │              │              │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐        │
│  │ User     │  │ Notifi-  │  │ Admin    │  │ Jobs     │        │
│  │ Module   │  │ cation   │  │ Module   │  │ (cron)   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘        │
│       └──────────────┴──────────────┘                            │
│                      Prisma ORM                                  │
│                         │                                        │
├─────────────────────────┼───────────────────────────────────────┤
│                    MySQL Database                                │
├─────────────────────────────────────────────────────────────────┤
│              External Services                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ SMTP     │  │ OneBot   │  │ Cloudflare│                     │
│  │ Server   │  │ WS Client│  │ Turnstile │                     │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

**后端架构模式**：模块化单体（Modular Monolith），每个业务模块包含 routes/controller/service/schema 四层，模块间通过 service 层调用。

**前端架构模式**：SPA + 路由级代码分割，React Query 管理服务端状态，Zustand 管理客户端状态。

---

## 2. 项目目录结构

### 2.1 完整文件列表

#### 后端（server/）

```
server/
├── package.json
├── tsconfig.json
├── .env.example
├── ecosystem.config.js                  # PM2 配置
│
├── prisma/
│   ├── schema.prisma                    # Prisma 数据库 schema
│   └── seed.ts                          # 数据库种子脚本（初始化超级管理员）
│
├── src/
│   ├── app.ts                           # Fastify 应用入口
│   ├── config/
│   │   ├── index.ts                     # 环境变量配置加载
│   │   ├── prisma.ts                    # Prisma Client 单例
│   │   └── fastify.ts                   # Fastify 实例工厂
│   │
│   ├── modules/
│   │   ├── auth/                        # 认证模块
│   │   │   ├── auth.routes.ts           # 路由定义
│   │   │   ├── auth.controller.ts       # 控制器
│   │   │   ├── auth.service.ts          # 业务逻辑
│   │   │   └── auth.schema.ts           # JSON Schema 校验
│   │   │
│   │   ├── user/                        # 用户模块
│   │   │   ├── user.routes.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.schema.ts
│   │   │
│   │   ├── device/                      # 设备模块
│   │   │   ├── device.routes.ts
│   │   │   ├── device.controller.ts
│   │   │   ├── device.service.ts
│   │   │   └── device.schema.ts
│   │   │
│   │   ├── report/                      # 设备上报模块
│   │   │   ├── report.routes.ts
│   │   │   ├── report.controller.ts
│   │   │   ├── report.service.ts
│   │   │   └── report.schema.ts
│   │   │
│   │   ├── alarm/                       # 告警日志模块
│   │   │   ├── alarm.routes.ts
│   │   │   ├── alarm.controller.ts
│   │   │   ├── alarm.service.ts
│   │   │   └── alarm.schema.ts
│   │   │
│   │   ├── notification/                # 通知模块
│   │   │   ├── notification.service.ts  # 通知调度（渠道分发）
│   │   │   ├── email.service.ts         # 邮件发送
│   │   │   ├── onebot.service.ts        # QQ 机器人推送
│   │   │   └── debounce.service.ts      # 防抖去重
│   │   │
│   │   └── admin/                       # 管理员模块
│   │       ├── activation/              # 激活码管理
│   │       │   ├── activation.routes.ts
│   │       │   ├── activation.controller.ts
│   │       │   ├── activation.service.ts
│   │       │   └── activation.schema.ts
│   │       ├── users/                   # 用户管理
│   │       │   ├── admin-users.routes.ts
│   │       │   ├── admin-users.controller.ts
│   │       │   ├── admin-users.service.ts
│   │       │   └── admin-users.schema.ts
│   │       ├── orders/                  # 订单管理
│   │       │   ├── orders.routes.ts
│   │       │   ├── orders.controller.ts
│   │       │   ├── orders.service.ts
│   │       │   └── orders.schema.ts
│   │       └── settings/                # 系统配置
│   │           ├── settings.routes.ts
│   │           ├── settings.controller.ts
│   │           ├── settings.service.ts
│   │           └── settings.schema.ts
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts           # JWT 认证中间件
│   │   ├── admin.middleware.ts          # 管理员权限中间件
│   │   ├── rateLimit.middleware.ts      # 速率限制中间件
│   │   ├── turnstile.middleware.ts      # Turnstile 人机验证中间件
│   │   └── error.middleware.ts          # 全局错误处理
│   │
│   ├── utils/
│   │   ├── jwt.ts                       # JWT 签发/验证
│   │   ├── bcrypt.ts                    # 密码哈希/比对
│   │   ├── crypto.ts                    # 激活码/设备 token 生成
│   │   ├── logger.ts                    # Pino 日志实例
│   │   ├── response.ts                  # 统一响应格式
│   │   └── csv.ts                       # CSV 导出工具
│   │
│   ├── types/
│   │   └── index.ts                     # 全局类型定义
│   │
│   └── jobs/                            # 定时任务
│       ├── index.ts                     # 任务注册入口
│       ├── heartbeat.job.ts             # 设备心跳检测（每分钟扫描）
│       └── cleanup.job.ts               # 数据清理（每日凌晨）
│
└── deploy/
    ├── nginx.conf.example               # Nginx 配置示例
    └── deploy.md                        # 部署文档
```

#### 前端（client/）

```
client/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
│
├── public/
│   └── favicon.svg
│
└── src/
    ├── main.tsx                         # React 入口
    ├── App.tsx                          # 根组件（路由配置）
    │
    ├── api/                             # API 客户端
    │   ├── client.ts                    # axios 实例 + 拦截器
    │   ├── auth.api.ts                  # 认证 API
    │   ├── device.api.ts                # 设备 API
    │   ├── alarm.api.ts                 # 告警 API
    │   ├── notification.api.ts          # 通知 API
    │   ├── user.api.ts                  # 用户 API
    │   └── admin.api.ts                 # 管理员 API
    │
    ├── components/                      # 通用组件
    │   ├── layout/
    │   │   ├── MainLayout.tsx           # 用户端布局（侧边栏+顶栏）
    │   │   ├── AdminLayout.tsx          # 管理员端布局
    │   │   ├── Sidebar.tsx              # 侧边栏导航
    │   │   └── TopBar.tsx               # 顶部导航栏
    │   ├── common/
    │   │   ├── StatCard.tsx             # 统计卡片
    │   │   ├── ConfirmDialog.tsx        # 确认对话框
    │   │   ├── EmptyState.tsx           # 空状态占位
    │   │   ├── LoadingOverlay.tsx       # 加载遮罩
    │   │   └── ToastProvider.tsx        # 全局消息提示
    │   └── device/
    │       ├── DeviceTable.tsx          # 设备列表表格
    │       ├── DeviceConfigDialog.tsx   # 设备配置弹窗
    │       └── BindDeviceDialog.tsx     # 绑定设备弹窗
    │
    ├── pages/                           # 页面组件
    │   ├── auth/
    │   │   ├── LoginPage.tsx            # 登录页
    │   │   ├── RegisterPage.tsx         # 注册页
    │   │   └── ForgotPasswordPage.tsx   # 找回密码页
    │   ├── DashboardPage.tsx            # 控制台概览
    │   ├── DevicesPage.tsx              # 设备管理
    │   ├── DeviceDetailPage.tsx         # 设备详情/配置
    │   ├── AlarmsPage.tsx               # 告警历史日志
    │   ├── NotificationsPage.tsx        # 通知配置
    │   ├── ProfilePage.tsx              # 个人中心
    │   └── admin/
    │       ├── AdminDashboardPage.tsx   # 管理员概览
    │       ├── ActivationCodesPage.tsx  # 激活码管理
    │       ├── UsersPage.tsx            # 用户管理
    │       ├── OrdersPage.tsx           # 订单管理
    │       └── SettingsPage.tsx         # 系统配置
    │
    ├── hooks/                           # 自定义 Hooks
    │   ├── useAuth.ts                   # 认证状态 Hook
    │   ├── useDevices.ts                # 设备数据 Hook
    │   ├── useAlarms.ts                 # 告警数据 Hook
    │   └── useToast.ts                  # 消息提示 Hook
    │
    ├── store/                           # Zustand 状态管理
    │   ├── auth.store.ts                # 认证状态
    │   └── ui.store.ts                  # UI 状态（侧边栏折叠等）
    │
    ├── types/                           # 类型定义
    │   └── index.ts                     # 前端类型（与后端共享）
    │
    ├── utils/                           # 工具函数
    │   ├── format.ts                    # 格式化（日期、状态等）
    │   ├── constants.ts                 # 常量定义
    │   └── validators.ts                # 表单校验规则
    │
    ├── routes/                          # 路由配置
    │   ├── index.tsx                    # 路由表
    │   └── ProtectedRoute.tsx           # 路由守卫
    │
    └── styles/
        └── global.css                   # 全局样式 + Tailwind 指令
```

---

## 3. 数据库设计

### 3.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ==================== 枚举 ====================

enum UserRole {
  user
  admin
}

enum MembershipLevel {
  free
  premium
}

enum ActivationCodeStatus {
  unused
  bound
  disabled
}

enum DeviceStatus {
  online
  offline
}

enum EventType {
  online
  offline
  alarm
}

enum OrderStatus {
  pending
  paid
  cancelled
  refunded
}

enum VerificationCodeType {
  register
  reset_password
}

// ==================== 模型 ====================

model User {
  id                  Int              @id @default(autoincrement())
  email               String           @unique @db.VarChar(255)
  password            String           @db.VarChar(255)
  nickname            String           @default("用户") @db.VarChar(50)
  role                UserRole         @default(user)
  membership_level    MembershipLevel  @default(free)
  membership_expire_at DateTime?
  qq_number           String?          @db.VarChar(20)
  login_fail_count    Int              @default(0)
  locked_until        DateTime?
  created_at          DateTime         @default(now())
  updated_at          DateTime         @updatedAt

  devices             Device[]
  activation_codes    ActivationCode[] // 用户绑定的激活码
  created_codes       ActivationCode[] @relation("ActivationCodeCreator") // 用户（管理员）创建的激活码
  events              Event[]
  orders              Order[]
  refresh_tokens      RefreshToken[]
  config_updates      SystemConfig[]   @relation("ConfigUpdater")

  @@index([email])
  @@index([role])
  @@index([membership_level])
}

model RefreshToken {
  id          Int      @id @default(autoincrement())
  user_id     Int
  token       String   @unique @db.VarChar(512)
  expires_at  DateTime
  created_at  DateTime @default(now())

  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([token])
}

model ActivationCode {
  id          Int                  @id @default(autoincrement())
  code        String               @unique @db.VarChar(32)
  status      ActivationCodeStatus @default(unused)
  created_by  Int                  // 创建者（管理员）user_id
  device_id   Int?                 // 绑定后的设备 ID
  user_id     Int?                 // 绑定后的用户 ID
  bound_at    DateTime?
  created_at  DateTime             @default(now())
  updated_at  DateTime             @updatedAt

  device      Device?
  user        User?                @relation(fields: [user_id], references: [id])
  creator     User                 @relation("ActivationCodeCreator", fields: [created_by], references: [id])

  @@index([code])
  @@index([status])
  @@index([created_by])
}

model Device {
  id                 Int           @id @default(autoincrement())
  user_id            Int
  activation_code_id Int           @unique
  name               String        @default("未命名设备") @db.VarChar(50)
  device_token       String        @unique @db.VarChar(64)
  status             DeviceStatus  @default(offline)
  last_report_at     DateTime?
  last_heartbeat_at  DateTime?
  created_at         DateTime      @default(now())
  updated_at         DateTime      @updatedAt

  user               User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  activation_code    ActivationCode @relation(fields: [activation_code_id], references: [id])
  config             DeviceConfig?
  events             Event[]

  @@index([user_id])
  @@index([status])
  @@index([device_token])
}

model DeviceConfig {
  id                Int      @id @default(autoincrement())
  device_id         Int      @unique
  notify_enabled    Boolean  @default(true)
  debounce_interval Int      @default(30) // 防抖间隔（秒），范围 5-3600
  notify_channels   Json     @default("[\"email\"]") // 通知渠道数组: ["email"] / ["email","qq_bot"]
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  device            Device   @relation(fields: [device_id], references: [id], onDelete: Cascade)
}

model Event {
  id          Int       @id @default(autoincrement())
  device_id   Int
  user_id     Int
  type        EventType
  detail      Json      // 事件详情，如 { "message": "人体检测告警", "report_data": {...} }
  created_at  DateTime  @default(now())

  device      Device    @relation(fields: [device_id], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([device_id])
  @@index([user_id])
  @@index([type])
  @@index([created_at])
}

model Order {
  id          Int         @id @default(autoincrement())
  order_no    String      @unique @db.VarChar(32)
  user_id     Int
  plan        String      @db.VarChar(50)    // 套餐名称
  amount      Decimal     @db.Decimal(10, 2) // 金额
  status      OrderStatus @default(pending)
  paid_at     DateTime?
  created_at  DateTime    @default(now())
  updated_at  DateTime    @updatedAt

  user        User        @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([status])
  @@index([created_at])
}

model SystemConfig {
  id           Int      @id @default(autoincrement())
  config_key   String   @unique @db.VarChar(100) // 如: smtp_host, smtp_port, onebot_ws_url
  config_value Json     // 配置值（支持复杂结构）
  updated_at   DateTime @updatedAt
  updated_by   Int?

  updater      User?    @relation("ConfigUpdater", fields: [updated_by], references: [id])

  @@index([config_key])
}

model VerificationCode {
  id          Int                  @id @default(autoincrement())
  email       String               @db.VarChar(255)
  code        String               @db.VarChar(6)
  type        VerificationCodeType
  expires_at  DateTime             // 5 分钟有效
  used        Boolean              @default(false)
  created_at  DateTime             @default(now())

  @@index([email, type])
  @@index([expires_at])
}
```

### 3.2 ER 关系图

```mermaid
erDiagram
    User ||--o{ Device : "owns"
    User ||--o{ ActivationCode : "binds"
    User ||--o{ ActivationCode : "creates"
    User ||--o{ Event : "triggers"
    User ||--o{ Order : "places"
    User ||--o{ RefreshToken : "has"
    User ||--o{ SystemConfig : "updates"

    ActivationCode ||--o| Device : "binds to"

    Device ||--|| DeviceConfig : "has"
    Device ||--o{ Event : "generates"

    User {
        int id PK
        varchar email UK
        varchar password
        varchar nickname
        enum role
        enum membership_level
        datetime membership_expire_at
        varchar qq_number
        int login_fail_count
        datetime locked_until
        datetime created_at
        datetime updated_at
    }

    ActivationCode {
        int id PK
        varchar code UK
        enum status
        int created_by FK
        int device_id FK
        int user_id FK
        datetime bound_at
        datetime created_at
    }

    Device {
        int id PK
        int user_id FK
        int activation_code_id FK
        varchar name
        varchar device_token UK
        enum status
        datetime last_report_at
        datetime last_heartbeat_at
        datetime created_at
    }

    DeviceConfig {
        int id PK
        int device_id FK
        boolean notify_enabled
        int debounce_interval
        json notify_channels
        datetime created_at
    }

    Event {
        int id PK
        int device_id FK
        int user_id FK
        enum type
        json detail
        datetime created_at
    }

    Order {
        int id PK
        varchar order_no UK
        int user_id FK
        varchar plan
        decimal amount
        enum status
        datetime paid_at
        datetime created_at
    }

    SystemConfig {
        int id PK
        varchar config_key UK
        json config_value
        datetime updated_at
        int updated_by FK
    }

    VerificationCode {
        int id PK
        varchar email
        varchar code
        enum type
        datetime expires_at
        boolean used
        datetime created_at
    }

    RefreshToken {
        int id PK
        int user_id FK
        varchar token UK
        datetime expires_at
        datetime created_at
    }
```

### 3.3 数据库设计说明

| 表名 | 说明 | 关键设计 |
|------|------|---------|
| `users` | 用户表（普通用户 + 管理员共用） | `role` 字区分角色；`membership_level`/`membership_expire_at` 预留会员字段；`login_fail_count`/`locked_until` 实现登录锁定 |
| `refresh_tokens` | 刷新令牌表 | 存储 refresh_token 实现主动失效；重置密码时删除该用户所有 token |
| `activation_codes` | 激活码表 | `code` 唯一；`status` 三态（unused/bound/disabled）；绑定后关联 user_id 和 device_id |
| `devices` | 设备表 | `device_token` 唯一，绑定后生成；`activation_code_id` 唯一外键（一对一）；`status` 在线/离线 |
| `device_configs` | 设备配置表 | 与 Device 一对一；`debounce_interval` 防抖间隔；`notify_channels` JSON 数组存储渠道 |
| `events` | 事件日志表 | `type` 三类（online/offline/alarm）；`detail` JSON 存储事件详情；按 `created_at` 索引便于时间范围查询和清理 |
| `orders` | 订单表 | P0 阶段管理员手动录入；预留结构支持后续接入支付 |
| `system_configs` | 系统配置表 | 键值对存储 SMTP/OneBot 配置；`config_value` 用 JSON 支持复杂结构 |
| `verification_codes` | 验证码表 | `type` 区分注册/重置密码；`expires_at` 5 分钟有效；`used` 标记已使用 |

---

## 4. 接口规范

### 4.1 统一响应格式

```typescript
// 所有 API 统一返回格式
interface ApiResponse<T = any> {
  code: number;      // 0 = 成功，非 0 = 错误（见错误码表）
  message: string;   // 提示信息
  data: T;           // 业务数据
}
```

### 4.2 认证机制

| 接口类型 | 鉴权方式 | Header |
|---------|---------|--------|
| 用户端 API | JWT access_token | `Authorization: Bearer <access_token>` |
| 管理员 API | JWT access_token + admin 角色 | `Authorization: Bearer <access_token>` |
| 设备上报 API | device_token 或 activation_code | `X-Device-Token: <token>` 或 `X-Activation-Code: <code>` |

### 4.3 API 端点列表

#### 4.3.1 认证模块 `/api/auth`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| POST | `/api/auth/send-code` | 无 + Turnstile | 发送验证码 | `{ email: string, type: "register" \| "reset_password" }` | `{ code: 0, message: "验证码已发送" }` |
| POST | `/api/auth/register` | 无 | 用户注册 | `{ email: string, code: string, password: string, nickname?: string }` | `{ code: 0, data: { accessToken, refreshToken, user } }` |
| POST | `/api/auth/login` | 无 + Turnstile | 用户登录 | `{ email: string, password: string }` | `{ code: 0, data: { accessToken, refreshToken, user } }` |
| POST | `/api/auth/forgot-password` | 无 + Turnstile | 发送重置密码验证码 | `{ email: string }` | `{ code: 0, message: "验证码已发送" }` |
| POST | `/api/auth/reset-password` | 无 | 重置密码 | `{ email: string, code: string, newPassword: string }` | `{ code: 0, message: "密码重置成功" }` |
| POST | `/api/auth/refresh` | refresh_token | 刷新 access_token | `{ refreshToken: string }` | `{ code: 0, data: { accessToken, refreshToken } }` |
| POST | `/api/auth/logout` | JWT | 退出登录 | 无 | `{ code: 0, message: "退出成功" }` |
| GET | `/api/auth/me` | JWT | 获取当前用户信息 | 无 | `{ code: 0, data: { user } }` |

#### 4.3.2 用户模块 `/api/user`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/user/profile` | JWT | 获取个人信息 | 无 | `{ code: 0, data: { user } }` |
| PUT | `/api/user/profile` | JWT | 修改昵称 | `{ nickname: string }` | `{ code: 0, data: { user } }` |
| PUT | `/api/user/password` | JWT | 修改密码 | `{ oldPassword: string, newPassword: string }` | `{ code: 0, message: "密码修改成功" }` |
| GET | `/api/user/membership` | JWT | 获取会员信息 | 无 | `{ code: 0, data: { membership } }` |
| PUT | `/api/user/qq` | JWT | 绑定 QQ 号 | `{ qqNumber: string }` | `{ code: 0, data: { user } }` |

#### 4.3.3 设备模块 `/api/devices`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/devices` | JWT | 设备列表 | Query: `?page=1&pageSize=20` | `{ code: 0, data: { list, total, page, pageSize } }` |
| GET | `/api/devices/:id` | JWT | 设备详情 | 无 | `{ code: 0, data: { device, config } }` |
| PUT | `/api/devices/:id` | JWT | 重命名设备 | `{ name: string }` | `{ code: 0, data: { device } }` |
| DELETE | `/api/devices/:id` | JWT | 删除设备 | 无 | `{ code: 0, message: "删除成功" }` |
| POST | `/api/devices/bind` | JWT | 绑定设备（激活码） | `{ activationCode: string }` | `{ code: 0, data: { device } }` |
| GET | `/api/devices/:id/config` | JWT | 获取设备配置 | 无 | `{ code: 0, data: { config } }` |
| PUT | `/api/devices/:id/config` | JWT | 修改设备配置 | `{ notifyEnabled?, debounceInterval?, notifyChannels? }` | `{ code: 0, data: { config } }` |

#### 4.3.4 告警日志模块 `/api/alarms`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/alarms` | JWT | 告警日志列表 | Query: `?deviceId=&type=&startDate=&endDate=&page=1&pageSize=20` | `{ code: 0, data: { list, total, page, pageSize } }` |
| GET | `/api/alarms/stats` | JWT | 告警统计 | Query: `?days=7` | `{ code: 0, data: { total, today, byDay: [...] } }` |

#### 4.3.5 设备上报模块 `/api/report`（设备端接口）

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| POST | `/api/report` | device_token / activation_code | 设备数据上报 | `{ status: "presence" \| "absence", timestamp?: number, extra?: object }` | `{ code: 0, message: "上报成功" }` |
| POST | `/api/report/heartbeat` | device_token | 设备心跳 | `{ timestamp?: number }` | `{ code: 0, message: "心跳成功" }` |

**上报请求头**：
```
X-Device-Token: <device_token>       # 优先使用（绑定后生成）
X-Activation-Code: <activation_code> # fallback（首次上报时使用）
```

**上报逻辑**：
1. 校验鉴权（device_token 优先，activation_code fallback）
2. 更新 `device.last_report_at` 和 `device.status = online`
3. 若 `status === "presence"`（无人→有人），触发防抖检查
4. 防抖通过 → 创建 alarm 事件 → 异步触发通知推送
5. 防抖不通过 → 静默丢弃（不创建事件，不推送通知）

#### 4.3.6 管理员 - 激活码管理 `/api/admin/activation`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| POST | `/api/admin/activation/generate` | admin | 批量生成激活码 | `{ count: number, prefix?: string }` | `{ code: 0, data: { codes: string[] } }` |
| GET | `/api/admin/activation` | admin | 激活码列表 | Query: `?status=&page=1&pageSize=20` | `{ code: 0, data: { list, total, page, pageSize } }` |
| PUT | `/api/admin/activation/:id/disable` | admin | 禁用激活码 | 无 | `{ code: 0, message: "禁用成功" }` |
| GET | `/api/admin/activation/export` | admin | 导出 CSV | Query: `?status=` | CSV 文件流 |

#### 4.3.7 管理员 - 用户管理 `/api/admin/users`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/admin/users` | admin | 用户列表 | Query: `?search=&page=1&pageSize=20` | `{ code: 0, data: { list, total, page, pageSize } }` |
| GET | `/api/admin/users/:id` | admin | 用户详情 | 无 | `{ code: 0, data: { user, deviceCount } }` |
| PUT | `/api/admin/users/:id/membership` | admin | 修改会员 | `{ level: "free" \| "premium", expireAt?: string }` | `{ code: 0, data: { user } }` |

#### 4.3.8 管理员 - 订单管理 `/api/admin/orders`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/admin/orders` | admin | 订单列表 | Query: `?status=&startDate=&endDate=&page=1&pageSize=20` | `{ code: 0, data: { list, total, page, pageSize } }` |
| POST | `/api/admin/orders` | admin | 手动创建订单 | `{ userId: number, plan: string, amount: number }` | `{ code: 0, data: { order } }` |
| GET | `/api/admin/orders/export` | admin | 导出 CSV | Query: `?status=` | CSV 文件流 |

#### 4.3.9 管理员 - 系统配置 `/api/admin/settings`

| Method | Path | 鉴权 | 说明 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/admin/settings` | admin | 获取系统配置 | 无 | `{ code: 0, data: { smtp: {...}, onebot: {...} } }` |
| PUT | `/api/admin/settings/smtp` | admin | 更新 SMTP 配置 | `{ host, port, username, password, from }` | `{ code: 0, message: "保存成功" }` |
| PUT | `/api/admin/settings/onebot` | admin | 更新 OneBot 配置 | `{ wsUrl, token }` | `{ code: 0, message: "保存成功" }` |
| POST | `/api/admin/settings/smtp/test` | admin | 测试 SMTP 发送 | `{ to: string }` | `{ code: 0, message: "测试邮件已发送" }` |
| POST | `/api/admin/settings/onebot/test` | admin | 测试 OneBot 连接 | 无 | `{ code: 0, message: "连接成功" }` |

---

## 5. 核心数据结构（类图）

```mermaid
classDiagram
    direction LR

    class User {
        +int id
        +string email
        +string password
        +string nickname
        +UserRole role
        +MembershipLevel membership_level
        +DateTime? membership_expire_at
        +string? qq_number
        +int login_fail_count
        +DateTime? locked_until
        +DateTime created_at
        +DateTime updated_at
    }

    class RefreshToken {
        +int id
        +int user_id
        +string token
        +DateTime expires_at
        +DateTime created_at
    }

    class ActivationCode {
        +int id
        +string code
        +ActivationCodeStatus status
        +int created_by
        +int? device_id
        +int? user_id
        +DateTime? bound_at
        +DateTime created_at
    }

    class Device {
        +int id
        +int user_id
        +int activation_code_id
        +string name
        +string device_token
        +DeviceStatus status
        +DateTime? last_report_at
        +DateTime? last_heartbeat_at
        +DateTime created_at
    }

    class DeviceConfig {
        +int id
        +int device_id
        +boolean notify_enabled
        +int debounce_interval
        +json notify_channels
        +DateTime created_at
    }

    class Event {
        +int id
        +int device_id
        +int user_id
        +EventType type
        +json detail
        +DateTime created_at
    }

    class Order {
        +int id
        +string order_no
        +int user_id
        +string plan
        +decimal amount
        +OrderStatus status
        +DateTime? paid_at
        +DateTime created_at
    }

    class SystemConfig {
        +int id
        +string config_key
        +json config_value
        +DateTime updated_at
        +int? updated_by
    }

    class VerificationCode {
        +int id
        +string email
        +string code
        +VerificationCodeType type
        +DateTime expires_at
        +boolean used
        +DateTime created_at
    }

    class AuthService {
        +sendVerificationCode(email, type) void
        +register(email, code, password) AuthResult
        +login(email, password) AuthResult
        +forgotPassword(email) void
        +resetPassword(email, code, newPassword) void
        +refreshToken(refreshToken) TokenPair
        +logout(userId) void
        +verifyTurnstile(token) boolean
    }

    class DeviceService {
        +listDevices(userId, page, pageSize) PaginatedResult
        +getDevice(userId, deviceId) Device
        +renameDevice(userId, deviceId, name) Device
        +deleteDevice(userId, deviceId) void
        +bindDevice(userId, activationCode) Device
        +getDeviceConfig(userId, deviceId) DeviceConfig
        +updateDeviceConfig(userId, deviceId, config) DeviceConfig
    }

    class ReportService {
        +handleReport(deviceToken, activationCode, data) void
        +handleHeartbeat(deviceToken) void
        -validateDevice(deviceToken, activationCode) Device
        -updateDeviceStatus(device, status) void
    }

    class DebounceService {
        +shouldTrigger(deviceId, debounceInterval) boolean
        -getLastAlarmTime(deviceId) DateTime?
    }

    class NotificationService {
        +dispatch(device, event, config) void
        -sendEmail(user, device, event) void
        -sendQQBot(user, device, event) void
    }

    class EmailService {
        +sendAlarmEmail(to, device, event) void
        +sendVerificationEmail(to, code, type) void
        +sendTestEmail(to) void
        -getTransporter() Transporter
        -retrySend(mailOptions, attempts) void
    }

    class OneBotService {
        +connect() void
        +disconnect() void
        +sendMessage(qqNumber, message) boolean
        +testConnection() boolean
        -reconnect() void
    }

    class AlarmService {
        +listAlarms(userId, filters, page, pageSize) PaginatedResult
        +getAlarmStats(userId, days) AlarmStats
        +createAlarmEvent(device, reportData) Event
    }

    class AdminActivationService {
        +generateCodes(count, prefix, adminId) string[]
        +listCodes(filters, page, pageSize) PaginatedResult
        +disableCode(codeId) void
        +exportCodes(filters) string
    }

    class AdminUserService {
        +listUsers(search, page, pageSize) PaginatedResult
        +getUserDetail(userId) UserDetail
        +updateMembership(userId, level, expireAt) void
    }

    class AdminOrderService {
        +listOrders(filters, page, pageSize) PaginatedResult
        +createOrder(userId, plan, amount) Order
        +exportOrders(filters) string
    }

    class AdminSettingsService {
        +getConfigs() SystemConfigs
        +updateSmtpConfig(config, adminId) void
        +updateOneBotConfig(config, adminId) void
        +testSmtp(to) void
        +testOneBot() void
    }

    class HeartbeatJob {
        +run() void
        -checkOfflineDevices() void
        -markOffline(deviceId) void
    }

    class CleanupJob {
        +run() void
        -cleanExpiredEvents() void
        -cleanExpiredTokens() void
        -cleanExpiredCodes() void
    }

    User "1" --> "0..*" RefreshToken : has
    User "1" --> "0..*" Device : owns
    User "1" --> "0..*" ActivationCode : creates
    User "1" --> "0..*" Event : triggers
    User "1" --> "0..*" Order : places
    ActivationCode "1" --> "0..1" Device : binds to
    Device "1" --> "1" DeviceConfig : has
    Device "1" --> "0..*" Event : generates

    AuthService --> User : manages
    AuthService --> VerificationCode : manages
    DeviceService --> Device : manages
    DeviceService --> ActivationCode : manages
    DeviceService --> DeviceConfig : manages
    ReportService --> Device : validates
    ReportService --> DebounceService : uses
    ReportService --> AlarmService : triggers
    AlarmService --> Event : creates
    AlarmService --> NotificationService : dispatches
    NotificationService --> EmailService : delegates
    NotificationService --> OneBotService : delegates
    EmailService --> SystemConfig : reads SMTP
    OneBotService --> SystemConfig : reads OneBot
    HeartbeatJob --> Device : checks
    HeartbeatJob --> Event : creates offline events
    CleanupJob --> Event : cleans
    CleanupJob --> RefreshToken : cleans
    CleanupJob --> VerificationCode : cleans
```

---

## 6. 程序调用流程（时序图）

### 6.1 用户注册流程

```mermaid
sequenceDiagram
    participant U as 用户(浏览器)
    participant F as 前端(React)
    participant B as 后端(Fastify)
    participant DB as 数据库(MySQL)
    participant M as SMTP服务器

    Note over U,M: 步骤1: 发送验证码
    U->>F: 输入邮箱，点击"发送验证码"
    F->>F: Turnstile 人机验证
    F->>B: POST /api/auth/send-code {email, type:"register"}
    B->>B: Turnstile 中间件校验 token
    B->>DB: 查 verification_codes WHERE email=? AND type=? AND created_at > (now-60s)
    DB-->>B: 无记录（60s内未发送过）
    B->>B: 生成6位随机验证码
    B->>DB: INSERT verification_codes {email, code, type, expires_at: now+5min}
    B->>M: 发送验证码邮件(nodemailer)
    M-->>U: 收到验证码邮件
    B-->>F: {code:0, message:"验证码已发送"}

    Note over U,M: 步骤2: 提交注册
    U->>F: 输入验证码+密码，点击"注册"
    F->>B: POST /api/auth/register {email, code, password}
    B->>DB: 查 verification_codes WHERE email=? AND code=? AND type="register" AND used=false AND expires_at > now
    DB-->>B: 验证码有效
    B->>DB: 查 users WHERE email=? (检查邮箱是否已注册)
    DB-->>B: 不存在
    B->>B: bcrypt.hash(password, 10)
    B->>DB: INSERT users {email, password, nickname, role:"user"}
    B->>DB: UPDATE verification_codes SET used=true
    B->>B: 生成 access_token(15min) + refresh_token(7d)
    B->>DB: INSERT refresh_tokens {user_id, token, expires_at}
    B-->>F: {code:0, data:{accessToken, refreshToken, user}}
    F->>F: 存储 token 到 localStorage
    F-->>U: 跳转控制台概览页
```

### 6.2 设备绑定流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    participant DB as 数据库

    U->>F: 输入激活码，点击"绑定设备"
    F->>B: POST /api/devices/bind {activationCode}
    B->>B: auth.middleware 校验 JWT
    B->>DB: 查 activation_codes WHERE code=? AND status="unused"
    
    alt 激活码不存在
        DB-->>B: null
        B-->>F: {code:2001, message:"激活码无效"}
        F-->>U: 提示"激活码无效"
    else 激活码已禁用
        DB-->>B: status="disabled"
        B-->>F: {code:2003, message:"激活码已禁用"}
    else 激活码有效
        DB-->>B: 找到激活码(status="unused")
        B->>B: 生成 device_token = crypto.randomBytes(32).toString('hex')
        B->>DB: INSERT devices {user_id, activation_code_id, device_token, status:"offline"}
        B->>DB: INSERT device_configs {device_id, notify_enabled:true, debounce_interval:30, notify_channels:["email"]}
        B->>DB: UPDATE activation_codes SET status="bound", user_id=?, device_id=?, bound_at=now
        B->>DB: INSERT events {device_id, user_id, type:"online", detail:{message:"设备绑定成功"}}
        B->>DB: UPDATE devices SET status="online", last_heartbeat_at=now
        B-->>F: {code:0, data:{device:{id, name, device_token, status}}}
        F-->>U: 显示绑定成功，提示保存 device_token
        F-->>U: 跳转设备列表
    end
```

### 6.3 设备上报与告警推送流程（含防抖去重）

```mermaid
sequenceDiagram
    participant D as 设备(ESP)
    participant B as 后端
    participant DB as 数据库
    participant DS as DebounceService
    participant AS as AlarmService
    participant NS as NotificationService
    participant ES as EmailService
    participant OB as OneBotService
    participant M as SMTP
    participant Q as OneBot(QQ)

    D->>B: POST /api/report {status:"presence"} Header: X-Device-Token
    B->>B: 解析 Header (device_token 优先, activation_code fallback)
    B->>DB: 查 devices WHERE device_token=? (或 activation_code 关联)
    
    alt 设备无效
        DB-->>B: null
        B-->>D: {code:2005, message:"设备未授权"}
    else 设备有效
        DB-->>B: device 记录
        B->>DB: UPDATE devices SET last_report_at=now, status="online"
        
        alt status !== "presence" (非告警上报)
            B-->>D: {code:0, message:"上报成功(无告警)"}
        else status === "presence" (人体检测)
            B->>DS: shouldTrigger(device.id, config.debounce_interval)
            DS->>DB: 查 events WHERE device_id=? AND type="alarm" ORDER BY created_at DESC LIMIT 1
            DB-->>DS: last_alarm_time
            
            alt 防抖窗口内 (now - last_alarm_time < debounce_interval)
                DS-->>B: false (去重丢弃)
                B-->>D: {code:0, message:"上报成功(已防抖)"}
            else 超过防抖窗口
                DS-->>B: true (允许告警)
                B->>AS: createAlarmEvent(device, reportData)
                AS->>DB: INSERT events {device_id, user_id, type:"alarm", detail:{...}}
                B-->>D: {code:0, message:"上报成功"} (同步返回)
                
                Note over B,Q: 异步通知推送 (setImmediate, 不阻塞响应)
                B->>DB: 查 device_configs WHERE device_id=?
                B->>NS: dispatch(device, event, config)
                
                alt notify_enabled === false
                    NS-->>B: 跳过通知
                else 通知开启
                    par 邮件渠道
                        NS->>ES: sendAlarmEmail(user.email, device, event)
                        ES->>M: transporter.sendMail()
                        alt 发送成功
                            M-->>ES: {messageId}
                        else 发送失败(≤3次)
                            M-->>ES: Error
                            ES->>ES: 重试(指数退避: 1s, 2s, 4s)
                        end
                        ES->>DB: 记录通知日志(可选)
                    and QQ渠道(付费用户)
                        NS->>OB: sendMessage(user.qq_number, message)
                        OB->>Q: WebSocket 发送私聊消息
                        alt 发送成功
                            Q-->>OB: {message_id}
                        else 发送失败
                            Q-->>OB: Error
                            OB->>NS: 降级到邮箱通知
                        end
                    end
                end
            end
        end
    end
```

### 6.4 邮件告警推送流程

```mermaid
sequenceDiagram
    participant NS as NotificationService
    participant ES as EmailService
    participant DB as 数据库
    participant T as nodemailer Transporter
    participant SMTP as SMTP服务器
    participant U as 用户邮箱

    NS->>DB: 查 system_configs WHERE config_key LIKE "smtp_%"
    DB-->>NS: {smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from}
    NS->>ES: sendAlarmEmail(to, device, event)
    ES->>ES: 创建邮件HTML模板(设备名+告警时间+告警类型)
    ES->>T: transporter.sendMail({from, to, subject, html})
    T->>SMTP: SMTP 连接 + 发送
    
    alt 第1次发送成功
        SMTP-->>T: 250 OK
        T-->>ES: {messageId, response}
        ES-->>NS: {success:true, messageId}
    else 第1次失败
        SMTP-->>T: Error(超时/认证失败)
        T-->>ES: Error
        ES->>ES: 等待1s后重试
        
        alt 第2次成功
            ES->>T: transporter.sendMail()
            T->>SMTP: 重试发送
            SMTP-->>T: 250 OK
            T-->>ES: {messageId}
            ES-->>NS: {success:true, attempts:2}
        else 第2次失败
            ES->>ES: 等待2s后重试
            alt 第3次成功
                ES->>T: transporter.sendMail()
                SMTP-->>T: 250 OK
                ES-->>NS: {success:true, attempts:3}
            else 第3次失败(放弃)
                ES-->>NS: {success:false, error:"3次重试均失败"}
                NS->>DB: 记录通知失败日志
                Note over NS: 降级策略: 如果QQ渠道可用,尝试QQ通知
            end
        end
    end
    
    ES-->>U: 用户收到告警邮件
```

### 6.5 设备心跳与离线检测流程

```mermaid
sequenceDiagram
    participant D as 设备
    participant B as 后端
    participant DB as 数据库
    participant J as HeartbeatJob(node-cron)

    Note over D,J: 心跳上报 (每60s)
    loop 每60秒
        D->>B: POST /api/report/heartbeat Header: X-Device-Token
        B->>DB: 查 devices WHERE device_token=?
        DB-->>B: device
        B->>DB: UPDATE devices SET last_heartbeat_at=now, status="online"
        B-->>D: {code:0, message:"心跳成功"}
    end

    Note over D,J: 离线检测 (每分钟执行)
    loop 每分钟 (node-cron)
        J->>DB: 查 devices WHERE status="online" AND last_heartbeat_at < (now - 5min)
        DB-->>J: [device1, device2, ...] (超时设备列表)
        loop 每个超时设备
            J->>DB: UPDATE devices SET status="offline"
            J->>DB: INSERT events {device_id, user_id, type:"offline", detail:{message:"设备心跳超时"}}
        end
    end
```

---

## 7. 任务列表

### 7.1 任务总览

| 任务ID | 任务名称 | 模块 | 文件数 | 依赖 | 优先级 |
|--------|---------|------|--------|------|--------|
| T01 | 项目基础设施 | 配置+入口 | 15 | 无 | P0 |
| T02 | 后端核心：数据层+认证+用户 | 后端-基础 | 16 | T01 | P0 |
| T03 | 后端业务：设备+上报+告警+通知+管理+定时任务 | 后端-业务 | 35 | T01, T02 | P0 |
| T04 | 前端核心：API+布局+认证页面+公共组件+路由 | 前端-基础 | 21 | T01, T02 | P0 |
| T05 | 前端业务页面：控制台+设备+告警+通知+个人中心+管理后台 | 前端-业务 | 16 | T01, T04 | P0 |

### 7.2 任务详情

#### T01: 项目基础设施

| 项目 | 内容 |
|------|------|
| **任务ID** | T01 |
| **任务名称** | 项目基础设施（后端+前端配置、入口、依赖声明） |
| **描述** | 搭建后端 Fastify + Prisma 项目骨架和前端 Vite + React + Tailwind + MUI 项目骨架，包括所有配置文件、入口文件、环境变量模板、PM2 配置、Nginx 配置示例。此任务完成后，前后端项目均可启动（空壳状态）。 |
| **涉及文件** | **后端**: `server/package.json`, `server/tsconfig.json`, `server/.env.example`, `server/ecosystem.config.js`, `server/src/app.ts`, `server/src/config/index.ts`, `server/src/config/prisma.ts`, `server/src/config/fastify.ts`, `server/src/utils/logger.ts`, `server/src/utils/response.ts`, `server/src/types/index.ts`, `server/deploy/nginx.conf.example`, `server/deploy/deploy.md` <br><br>**前端**: `client/package.json`, `client/tsconfig.json`, `client/tsconfig.node.json`, `client/vite.config.ts`, `client/tailwind.config.ts`, `client/postcss.config.js`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/styles/global.css`, `client/src/types/index.ts` |
| **依赖任务** | 无 |
| **优先级** | P0 |
| **验收标准** | ① 后端 `npm run dev` 可启动 Fastify 服务监听 3000 端口 ② 前端 `npm run dev` 可启动 Vite 开发服务器 ③ Prisma client 可正常生成 ④ TypeScript 编译无报错 ⑤ 环境变量模板完整 |

#### T02: 后端核心 — 数据层 + 认证 + 用户模块

| 项目 | 内容 |
|------|------|
| **任务ID** | T02 |
| **任务名称** | 数据库 Schema + 认证模块 + 用户模块 + 公共中间件 |
| **描述** | 编写完整的 Prisma schema（所有表结构），实现认证模块（注册/登录/找回密码/验证码/JWT 双 token），实现用户个人信息模块，编写公共中间件（JWT 鉴权、管理员鉴权、速率限制、Turnstile 验证、全局错误处理），编写工具函数（JWT/bcrypt/crypto），实现 seed 脚本初始化超级管理员。 |
| **涉及文件** | `server/prisma/schema.prisma`, `server/prisma/seed.ts`, `server/src/modules/auth/auth.routes.ts`, `server/src/modules/auth/auth.controller.ts`, `server/src/modules/auth/auth.service.ts`, `server/src/modules/auth/auth.schema.ts`, `server/src/modules/user/user.routes.ts`, `server/src/modules/user/user.controller.ts`, `server/src/modules/user/user.service.ts`, `server/src/modules/user/user.schema.ts`, `server/src/middlewares/auth.middleware.ts`, `server/src/middlewares/admin.middleware.ts`, `server/src/middlewares/rateLimit.middleware.ts`, `server/src/middlewares/turnstile.middleware.ts`, `server/src/middlewares/error.middleware.ts`, `server/src/utils/jwt.ts`, `server/src/utils/bcrypt.ts`, `server/src/utils/crypto.ts` |
| **依赖任务** | T01 |
| **优先级** | P0 |
| **验收标准** | ① `npx prisma migrate dev` 可成功建表 ② `npm run seed` 可创建超级管理员 ③ 注册→发送验证码→注册成功→自动登录 全流程通过 ④ 登录→获取 token→访问受保护接口 全流程通过 ⑤ 找回密码→重置→旧 token 失效 全流程通过 ⑥ 密码错误 5 次锁定 15 分钟 ⑦ Turnstile 验证中间件正常工作 ⑧ 速率限制中间件正常工作 |

#### T03: 后端业务 — 设备 + 上报 + 告警 + 通知 + 管理 + 定时任务

| 项目 | 内容 |
|------|------|
| **任务ID** | T03 |
| **任务名称** | 设备管理 + 数据上报 + 告警日志 + 通知推送 + 管理员后台 + 定时任务 |
| **描述** | 实现设备管理模块（列表/详情/重命名/删除/绑定/配置），实现设备上报模块（数据上报/心跳/防抖去重），实现告警日志模块（查询/统计），实现通知模块（邮件发送/QQ机器人推送/防抖服务），实现管理员模块（激活码管理/用户管理/订单管理/系统配置），实现定时任务（心跳检测/数据清理）。此任务完成后，后端所有 API 全部可用。 |
| **涉及文件** | `server/src/modules/device/device.routes.ts`, `server/src/modules/device/device.controller.ts`, `server/src/modules/device/device.service.ts`, `server/src/modules/device/device.schema.ts`, `server/src/modules/report/report.routes.ts`, `server/src/modules/report/report.controller.ts`, `server/src/modules/report/report.service.ts`, `server/src/modules/report/report.schema.ts`, `server/src/modules/alarm/alarm.routes.ts`, `server/src/modules/alarm/alarm.controller.ts`, `server/src/modules/alarm/alarm.service.ts`, `server/src/modules/alarm/alarm.schema.ts`, `server/src/modules/notification/notification.service.ts`, `server/src/modules/notification/email.service.ts`, `server/src/modules/notification/onebot.service.ts`, `server/src/modules/notification/debounce.service.ts`, `server/src/modules/admin/activation/activation.routes.ts`, `server/src/modules/admin/activation/activation.controller.ts`, `server/src/modules/admin/activation/activation.service.ts`, `server/src/modules/admin/activation/activation.schema.ts`, `server/src/modules/admin/users/admin-users.routes.ts`, `server/src/modules/admin/users/admin-users.controller.ts`, `server/src/modules/admin/users/admin-users.service.ts`, `server/src/modules/admin/users/admin-users.schema.ts`, `server/src/modules/admin/orders/orders.routes.ts`, `server/src/modules/admin/orders/orders.controller.ts`, `server/src/modules/admin/orders/orders.service.ts`, `server/src/modules/admin/orders/orders.schema.ts`, `server/src/modules/admin/settings/settings.routes.ts`, `server/src/modules/admin/settings/settings.controller.ts`, `server/src/modules/admin/settings/settings.service.ts`, `server/src/modules/admin/settings/settings.schema.ts`, `server/src/jobs/index.ts`, `server/src/jobs/heartbeat.job.ts`, `server/src/jobs/cleanup.job.ts`, `server/src/utils/csv.ts` |
| **依赖任务** | T01, T02 |
| **优先级** | P0 |
| **验收标准** | ① 管理员可生成激活码，用户可用激活码绑定设备 ② 设备可用 device_token 上报数据，防抖去重正常工作 ③ 告警触发后邮件发送成功，失败有重试 ④ 付费用户 QQ 通知推送正常 ⑤ 心跳超时设备自动标记离线并写事件日志 ⑥ 告警日志支持按设备/时间/类型筛选分页 ⑦ 管理员可管理用户会员、订单、系统配置 ⑧ 定时清理任务正常执行 ⑨ CSV 导出功能正常 |

#### T04: 前端核心 — API 客户端 + 布局 + 认证页面 + 公共组件 + 路由

| 项目 | 内容 |
|------|------|
| **任务ID** | T04 |
| **任务名称** | axios 封装 + React Query 配置 + Zustand store + 布局组件 + 认证页面 + 公共组件 + 路由配置 |
| **描述** | 搭建前端基础设施：封装 axios 客户端（含 token 拦截器/自动刷新），配置 React Query，创建 Zustand auth store，实现用户端和管理员端布局组件（侧边栏+顶栏），实现登录/注册/找回密码页面（含 Turnstile），实现公共组件（统计卡片/确认对话框/空状态/Toast），配置路由表和路由守卫。 |
| **涉及文件** | `client/src/api/client.ts`, `client/src/api/auth.api.ts`, `client/src/api/device.api.ts`, `client/src/api/alarm.api.ts`, `client/src/api/notification.api.ts`, `client/src/api/user.api.ts`, `client/src/api/admin.api.ts`, `client/src/store/auth.store.ts`, `client/src/store/ui.store.ts`, `client/src/hooks/useAuth.ts`, `client/src/hooks/useToast.ts`, `client/src/components/layout/MainLayout.tsx`, `client/src/components/layout/AdminLayout.tsx`, `client/src/components/layout/Sidebar.tsx`, `client/src/components/layout/TopBar.tsx`, `client/src/components/common/StatCard.tsx`, `client/src/components/common/ConfirmDialog.tsx`, `client/src/components/common/EmptyState.tsx`, `client/src/components/common/ToastProvider.tsx`, `client/src/pages/auth/LoginPage.tsx`, `client/src/pages/auth/RegisterPage.tsx`, `client/src/pages/auth/ForgotPasswordPage.tsx`, `client/src/routes/index.tsx`, `client/src/routes/ProtectedRoute.tsx`, `client/src/utils/format.ts`, `client/src/utils/constants.ts` |
| **依赖任务** | T01, T02 |
| **优先级** | P0 |
| **验收标准** | ① 登录/注册/找回密码页面完整可用（含 Turnstile） ② axios 拦截器自动携带 token，401 时自动刷新 ③ 路由守卫正确拦截未登录用户 ④ 用户端/管理员端布局正确渲染 ⑤ 公共组件可复用 ⑥ React Query 缓存正常工作 |

#### T05: 前端业务页面 — 控制台 + 设备 + 告警 + 通知 + 个人中心 + 管理后台

| 项目 | 内容 |
|------|------|
| **任务ID** | T05 |
| **任务名称** | 控制台概览 + 设备管理 + 告警历史 + 通知配置 + 个人中心 + 管理员全部页面 |
| **描述** | 实现所有业务页面：控制台概览页（统计卡片+最近告警），设备管理页（列表+绑定+配置弹窗+内联编辑），设备详情页，告警历史页（筛选+分页+展开详情），通知配置页（卡片视图+配置弹窗），个人中心页（信息+密码+会员），管理员页面（激活码管理+用户管理+订单管理+系统配置）。 |
| **涉及文件** | `client/src/pages/DashboardPage.tsx`, `client/src/pages/DevicesPage.tsx`, `client/src/pages/DeviceDetailPage.tsx`, `client/src/pages/AlarmsPage.tsx`, `client/src/pages/NotificationsPage.tsx`, `client/src/pages/ProfilePage.tsx`, `client/src/pages/admin/AdminDashboardPage.tsx`, `client/src/pages/admin/ActivationCodesPage.tsx`, `client/src/pages/admin/UsersPage.tsx`, `client/src/pages/admin/OrdersPage.tsx`, `client/src/pages/admin/SettingsPage.tsx`, `client/src/components/device/DeviceTable.tsx`, `client/src/components/device/DeviceConfigDialog.tsx`, `client/src/components/device/BindDeviceDialog.tsx`, `client/src/hooks/useDevices.ts`, `client/src/hooks/useAlarms.ts`, `client/src/utils/validators.ts` |
| **依赖任务** | T01, T04（T03 的 API 完成后可联调） |
| **优先级** | P0 |
| **验收标准** | ① 控制台显示正确的统计数据和最近告警 ② 设备管理页可绑定/重命名/配置/删除设备 ③ 告警历史页筛选和分页正常 ④ 通知配置页可编辑各设备配置 ⑤ 个人中心可修改信息和密码 ⑥ 管理员页面全部可用（激活码生成/用户管理/订单/系统配置） ⑦ UI 符合 PRD 设计要求（雨云风格） |

### 7.3 任务依赖图

```mermaid
graph LR
    T01[T01: 项目基础设施] --> T02[T02: 后端核心<br/>数据层+认证+用户]
    T01 --> T04[T04: 前端核心<br/>API+布局+认证+公共组件]
    T02 --> T03[T03: 后端业务<br/>设备+上报+告警+通知+管理+任务]
    T04 --> T05[T05: 前端业务页面<br/>控制台+设备+告警+通知+个人中心+管理后台]
    T03 -.->|API 联调| T05

    style T01 fill:#4CAF50,color:#fff
    style T02 fill:#2196F3,color:#fff
    style T03 fill:#2196F3,color:#fff
    style T04 fill:#FF9800,color:#fff
    style T05 fill:#FF9800,color:#fff
```

**执行策略**：
- T01 完成后，T02 和 T04 可**并行开发**（后端核心 vs 前端核心）
- T02 完成后，T03 可开始（后端业务）
- T04 完成后，T05 可开始（前端业务页面）
- T03 和 T05 完成后进行前后端联调
- **关键路径**：T01 → T02 → T03（后端）与 T01 → T04 → T05（前端）并行推进

---

## 8. 依赖包列表

### 8.1 后端依赖（server/package.json）

```json
{
  "dependencies": {
    "fastify": "^4.25.0",
    "@fastify/cors": "^8.5.0",
    "@fastify/helmet": "^11.0.0",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/multipart": "^8.3.0",
    "@prisma/client": "^5.8.0",
    "mysql2": "^3.7.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "nodemailer": "^6.9.8",
    "node-cron": "^3.0.3",
    "ws": "^8.16.0",
    "axios": "^1.6.5",
    "zod": "^3.22.4",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0",
    "dotenv": "^16.3.1",
    "nanoid": "^5.0.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "prisma": "^5.8.0",
    "@types/node": "^20.10.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/nodemailer": "^6.4.14",
    "@types/node-cron": "^3.0.11",
    "@types/ws": "^8.5.10"
  },
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "seed": "ts-node prisma/seed.ts",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  }
}
```

### 8.2 前端依赖（client/package.json）

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.2",
    "@mui/material": "^5.15.4",
    "@mui/icons-material": "^5.15.4",
    "@emotion/react": "^11.11.3",
    "@emotion/styled": "^11.11.0",
    "@tanstack/react-query": "^5.17.9",
    "zustand": "^4.4.7",
    "axios": "^1.6.5",
    "react-hook-form": "^7.49.2",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.2",
    "recharts": "^2.10.4",
    "dayjs": "^1.11.10"
  },
  "devDependencies": {
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## 9. 共享知识（跨文件约定）

### 9.1 API 响应格式

```typescript
// 所有 API 统一返回
interface ApiResponse<T = any> {
  code: number;      // 0 = 成功
  message: string;   // 人类可读的提示信息
  data: T;           // 业务数据，失败时为 null
}

// 分页响应
interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 9.2 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| 0 | 200 | 成功 |
| 1001 | 401 | 邮箱或密码错误 |
| 1002 | 403 | 账号已锁定 |
| 1003 | 409 | 邮箱已注册 |
| 1004 | 400 | 验证码错误 |
| 1005 | 400 | 验证码已过期 |
| 1006 | 429 | 验证码发送过于频繁（60s 内） |
| 1007 | 400 | 密码强度不足 |
| 1008 | 400 | 旧密码错误 |
| 2001 | 400 | 激活码无效 |
| 2002 | 409 | 激活码已被绑定 |
| 2003 | 403 | 激活码已禁用 |
| 2004 | 404 | 设备不存在 |
| 2005 | 401 | 设备未授权（token/激活码无效） |
| 2006 | 403 | 设备不属于当前用户 |
| 3001 | 401 | 未登录（缺少 token） |
| 3002 | 403 | 无权限（需要管理员角色） |
| 3003 | 401 | Token 已过期 |
| 3004 | 401 | Token 无效 |
| 4001 | 400 | 参数校验失败 |
| 4002 | 429 | 请求频率超限 |
| 5001 | 500 | 服务器内部错误 |
| 5002 | 500 | 邮件发送失败 |
| 5003 | 500 | OneBot 连接失败 |
| 5004 | 500 | 数据库错误 |

### 9.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case（路由/控制器/服务文件） | `auth.routes.ts`, `device.service.ts` |
| 文件名 | PascalCase（React 组件文件） | `DashboardPage.tsx`, `MainLayout.tsx` |
| 变量/函数 | camelCase | `getUserById`, `accessToken` |
| 类/接口/类型 | PascalCase | `AuthService`, `DeviceConfig` |
| 常量 | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS`, `JWT_ACCESS_EXPIRES` |
| 数据库表 | snake_case (Prisma 自动映射) | `users`, `activation_codes` |
| 数据库字段 | snake_case (Prisma 自动映射) | `created_at`, `user_id` |
| API 路径 | kebab-case | `/api/admin/activation-codes` |
| 环境变量 | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_ACCESS_SECRET` |

### 9.4 环境变量清单

#### 后端（server/.env.example）

```bash
# ===== 应用配置 =====
NODE_ENV=development
PORT=3000

# ===== 数据库 =====
DATABASE_URL="mysql://root:password@localhost:3306/pir_cloud"

# ===== JWT =====
JWT_ACCESS_SECRET=your-access-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ===== 密码哈希 =====
BCRYPT_SALT_ROUNDS=10

# ===== Turnstile (Cloudflare) =====
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_VERIFY_URL=https://challenges.cloudflare.com/turnstile/v0/siteverify

# ===== 设备配置 =====
DEVICE_TOKEN_LENGTH=32
HEARTBEAT_TIMEOUT_SECONDS=300

# ===== 数据保留 =====
DATA_RETENTION_DAYS=90

# ===== 超级管理员 (seed 脚本使用) =====
SEED_ADMIN_EMAIL=admin@pir-cloud.local
SEED_ADMIN_PASSWORD=ChangeMe123!

# ===== OneBot (初始配置，也可在管理后台修改) =====
ONEBOT_WS_URL=ws://127.0.0.1:8080
ONEBOT_TOKEN=
```

#### 前端（client/.env.example）

```bash
# ===== API =====
VITE_API_BASE_URL=http://localhost:3000/api

# ===== Turnstile =====
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

### 9.5 日志格式

```typescript
// Pino JSON 日志格式
{
  "level": "info",           // info/warn/error
  "time": 1705788000000,     // Unix 时间戳
  "msg": "User registered",  // 日志消息
  "userId": 42,              // 上下文：用户 ID
  "email": "user@example.com",
  "requestId": "abc-123",    // 请求追踪 ID
  "module": "auth"           // 模块名
}
```

### 9.6 日期时间约定

- 数据库存储：UTC 时间（Prisma DateTime 自动处理）
- API 传输：ISO 8601 格式字符串（如 `2025-01-20T10:30:00.000Z`）
- 前端显示：使用 dayjs 转换为本地时区显示

### 9.7 安全约定

1. **密码**：bcrypt 哈希存储，salt rounds ≥ 10，禁止明文存储/传输/返回
2. **JWT**：access_token 15min，refresh_token 7d 存数据库可主动失效
3. **SQL 注入**：Prisma 参数化查询，禁止拼接 SQL
4. **XSS**：Fastify helmet 中间件 + 前端 React 自动转义
5. **CSRF**：JWT 方案天然防 CSRF（不使用 Cookie 传输 token）
6. **速率限制**：认证接口 5 次/分钟，上报接口 60 次/分钟
7. **HTTPS**：生产环境强制 HTTPS（Nginx + Let's Encrypt）
8. **Turnstile**：注册/登录/找回密码页面接入人机验证

### 9.8 前后端类型共享约定

后端 Prisma 生成的类型可通过以下方式与前端共享：
- 后端 API 响应中包含完整的类型信息
- 前端 `client/src/types/index.ts` 手动维护与后端一致的接口定义
- 后续可考虑使用 `prisma-generator` 生成前端类型（P1 优化）

---

## 10. 待明确事项

| # | 待明确事项 | 影响范围 | 当前处理方式 | 建议跟进时机 |
|---|-----------|---------|-------------|-------------|
| 1 | OneBot v11 协议的具体消息格式 | OneBot 推送 | 按 OneBot v11 标准私聊消息格式实现（`/send_private_msg`），如实际 OneBot 实现有差异需调整 | 部署 OneBot 实例后验证 |
| 2 | 会员套餐的具体定价和周期 | 订单模块、会员模块 | P0 阶段管理员手动开通，订单表预留结构，不接入支付 | 商业决策确定后迭代 |
| 3 | 设备上报的 `extra` 字段具体内容 | 上报接口 | 预留 `extra: object` 字段，按需扩展 | 硬件端协议确定后补充 |
| 4 | QQ 通知的降级策略细节 | 通知模块 | 当前设计为 QQ 失败后降级到邮箱，但未定义降级通知的邮件内容模板 | P1 阶段细化 |
| 5 | 审计日志（REQ-028）的表结构 | 管理员模块 | P2 范围，当前未设计审计日志表，管理员操作暂仅记录到事件日志 | P2 迭代时补充 |
| 6 | 前端类型与后端 Prisma 类型的同步机制 | 前后端协作 | 手动维护前端类型定义文件，可能产生不一致 | P1 引入自动生成方案 |
| 7 | 邮件模板的具体 HTML 设计 | 邮件通知 | 当前仅定义内容要素（设备名/告警时间/告警类型），HTML 模板待设计 | UI 设计阶段补充 |
| 8 | 设备删除后的激活码处理策略 | 设备模块 | 当前设计为删除设备后激活码状态保持 "bound"（不可重用），如需释放需管理员手动处理 | 确认业务规则后调整 |

---

> **文档结束** — 本架构设计文档基于 PRD v1.0 和主理人确认的 10 项决策编写，覆盖系统设计、数据库设计、接口规范、任务分解全流程。工程师可基于任务列表（T01-T05）开始实施。

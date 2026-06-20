# pir-cloud — 交付报告

| 字段 | 内容 |
|------|------|
| 项目名称 | pir-cloud（原 Workbody，已更名） |
| 交付日期 | 2025-06-17 |
| 工作流 | 标准 SOP（PRD → 架构 → 代码 → 测试） |
| 团队 | software-workbody |
| 交付状态 | ✅ 完成 |

---

## TL;DR

完整交付一套物联网人体感应云端告警面板：前后端分离全栈代码（118 源文件）+ 97 单元测试全通过 + TypeScript 类型检查 0 错误 + 完整部署文档。覆盖账号体系、设备管理、状态变化上报、防抖去重、邮箱/QQ 双通道告警、管理员后台五大模块。

---

## 一、交付概览

| 维度 | 结果 |
|------|------|
| 交付状态 | ✅ 完成 |
| 单元测试通过率 | 97/97（100%） |
| 后端 TS 类型检查 | ✅ 0 错误 |
| 前端 TS 类型检查 | ✅ 0 错误 |
| 已知遗留问题 | 5 项（均为非阻塞优化项） |

---

## 二、团队协作流程

| 阶段 | 负责人 | 产出 | 状态 |
|------|--------|------|------|
| ① PRD | 许清楚（产品经理） | 28 条需求（P0:18/P1:6/P2:4）+ 9 用户故事 + 12 页面设计 | ✅ |
| ② 架构设计 | 高见远（架构师） | 8 表 Prisma schema + 40+ API + 5 任务分解 + 4 时序图 | ✅ |
| ③ 代码实现 | 寇豆码（工程师） | 后端 69 文件 + 前端 54 文件，两轮 IS_PASS: YES | ✅ |
| ④ 测试验证 | 严过关（QA） | 97 测试用例全通过 + 8 个 TS 错误定位 | ✅ |
| ⑤ 修复收尾 | 主理人接手 | 8 个 TS 类型错误修复 + 回归验证 | ✅ |

---

## 三、文件清单

### 交付文档（4 文件）
- `D:\pir\deliverables\workbody\PRD.md` — 产品需求文档（23KB）
- `D:\pir\deliverables\workbody\ARCHITECTURE.md` — 系统架构设计（72KB）
- `D:\pir\deliverables\workbody\class-diagram.mermaid` — 类图
- `D:\pir\deliverables\workbody\sequence-diagram.mermaid` — 时序图

### 后端代码（72 文件，`D:\pir\workbody\server\`）

**项目配置（6 文件）**：
- `package.json` / `tsconfig.json` / `vitest.config.ts` / `ecosystem.config.js` / `.env.example`
- `deploy/deploy.md` — 完整部署文档
- `deploy/nginx.conf.example` — Nginx 反向代理配置

**数据层（2 文件）**：
- `prisma/schema.prisma` — 8 张表 + 7 枚举（users/refresh_tokens/activation_codes/devices/device_configs/events/orders/system_configs/verification_codes）
- `prisma/seed.ts` — 初始化超级管理员 + 默认系统配置

**核心模块（19 文件）**：
- `src/modules/auth/` — 注册/登录/找回密码/验证码/JWT 双 token 轮换（routes/controller/service/schema）
- `src/modules/user/` — 个人信息/改密码/会员/QQ 绑定
- `src/middlewares/` — auth/admin/rateLimit/turnstile/error 五大中间件
- `src/utils/` — jwt/bcrypt/crypto 三大工具

**业务模块（35 文件）**：
- `src/modules/device/` — 设备 CRUD + 激活码绑定事务
- `src/modules/report/` — 数据上报（device_token 优先/激活码 fallback）+ 心跳
- `src/modules/alarm/` — 告警日志查询 + 统计
- `src/modules/notification/` — email.service（3 次重试指数退避）+ onebot.service（WS + 降级邮箱）+ debounce.service（防抖去重）+ notification.service（渠道调度）
- `src/modules/admin/` — activation/users/orders/settings 四大管理子模块
- `src/jobs/` — heartbeat（每分钟扫描 5min 超时）+ cleanup（每日清理 90 天数据）

**测试（9 文件，97 用例）**：
- `tests/crypto.test.ts`（15 例）— 激活码/token/验证码生成
- `tests/bcrypt.test.ts`（10 例）— 密码哈希/比对/强度
- `tests/jwt.test.ts`（11 例）— 双 token 签发/验证
- `tests/auth.service.test.ts`（15 例）— 验证码防重发/登录锁定/refresh 轮换
- `tests/debounce.service.test.ts`（5 例）— 防抖去重
- `tests/report.service.test.ts`（14 例）— 上报鉴权/防抖/异步通知
- `tests/notification.service.test.ts`（10 例）— 邮件重试/QQ 降级
- `tests/device.service.test.ts`（12 例）— 激活码绑定事务
- `tests/email.service.test.ts`（5 例）— SMTP 重试机制

### 前端代码（46 文件，`D:\pir\workbody\web\`）

**项目配置（8 文件）**：
- `package.json` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts`
- `tailwind.config.js` / `postcss.config.js` / `index.html` / `.env.example`

**基础设施（18 文件）**：
- `src/main.tsx` / `App.tsx` — 入口与路由
- `src/api/` — client.ts（axios 拦截器 + 401 自动 refresh + 并发队列）+ 6 个 API 模块
- `src/store/` — auth.store.ts（Zustand + localStorage）+ ui.store.ts
- `src/hooks/` — useAuth/useToast/useDebounce/useDevices/useAlarms
- `src/components/Layout/` — MainLayout/AdminLayout/AuthGuard
- `src/components/common/` — StatCard/ConfirmDialog/EmptyState/ToastProvider/PageCard/StatusBadge
- `src/types/index.ts` / `src/utils/` — constants/format/validators

**业务页面（20 文件）**：
- `src/pages/auth/` — Login/Register/ForgotPassword（Turnstile 占位）
- `src/pages/dashboard/` — 控制台概览（4 统计卡片 + 最近告警 + 30s 轮询）
- `src/pages/devices/` — DevicesPage + DeviceDetailPage（绑定/重命名/配置抽屉）
- `src/pages/alarms/` — 告警历史（筛选 + 分页 + 展开详情）
- `src/pages/notifications/` — 通知配置（卡片视图 + 编辑弹窗）
- `src/pages/profile/` — 个人中心（信息/会员/改密码/绑 QQ）
- `src/pages/admin/` — AdminDashboard/ActivationCodes/AdminUsers/Orders/Settings

---

## 四、关键技术决策

| 决策点 | 方案 |
|--------|------|
| 后端框架 | Fastify（性能优 + JSON Schema 校验 + Pino 日志） |
| ORM | Prisma（类型安全 + 迁移管理） |
| 认证 | JWT 双 token（access 15min + refresh 7d 存 DB，支持主动失效） |
| 设备鉴权 | device_token 优先 + 激活码 fallback |
| 告警异步化 | setImmediate 推送通知，不阻塞上报响应 |
| 邮件重试 | nodemailer 3 次指数退避（1s/2s/4s） |
| OneBot 降级 | QQ 推送失败自动降级邮箱 |
| 心跳检测 | 60s 心跳 + 5min 超时判离线（node-cron 每分钟扫描） |
| 数据清理 | node-cron 每日凌晨 3am 清理 90 天前数据 |
| 前端状态 | React Query（服务端状态）+ Zustand（客户端状态） |
| 前端鉴权 | axios 拦截器 401 自动 refresh + 并发队列 |

---

## 五、测试验证结果

```
Test Files  9 passed (9)
     Tests  97 passed (97)
  Duration  7.09s

后端 tsc --noEmit: 0 errors ✅
前端 tsc --noEmit: 0 errors ✅
```

**修复记录**：QA 第 1 轮发现 8 个 TS 类型错误，寇豆码未及时响应，主理人接手修复：
- 后端 2 项：VerificationCodeType 类型导出、device.controller NotifyChannel 类型
- 前端 6 项：client.ts 导入路径、vite-env.d.ts 创建、SlideProps 改 any、NodeJS.Timeout 改 ReturnType、useAuthStore 导入

---

## 六、已知遗留问题（非阻塞）

1. **Turnstile 集成**：当前为 UI 占位组件，需安装 `react-turnstile` 并接入 Cloudflare script
2. **邮件 HTML 模板**：当前内联简单模板，建议提取为独立模板文件
3. **前端测试框架**：未配置 vitest/jest，建议后续添加 `@testing-library/react`
4. **路由级代码分割**：当前同步导入，可改 React.lazy + Suspense 优化首屏
5. **P2 功能未实现**：告警趋势图表、多设备批量操作、通知模板自定义、操作审计日志

---

## 七、用户下一步建议

### 1. 启动开发环境

```bash
# 后端
cd D:\pir\workbody\server
npm install
cp .env.example .env  # 编辑数据库连接、JWT 密钥、Turnstile Key
npm run db:generate
npm run db:migrate     # 需先创建 MySQL 数据库 pir_cloud
npm run seed           # 初始化超级管理员
npm run dev

# 前端（新终端）
cd D:\pir\workbody\web
npm install
cp .env.example .env   # 配置 VITE_API_BASE_URL 和 VITE_TURNSTILE_SITE_KEY
npm run dev
```

### 2. 生产部署

参考 `D:\pir\workbody\server\deploy\deploy.md`，关键步骤：
- PM2 进程管理：`pm2 start ecosystem.config.js --env production`
- Nginx 反向代理 + Let's Encrypt SSL（配置参考 `deploy/nginx.conf.example`）
- 邮件域名配置 SPF/DKIM 提升送达率

### 3. 后续迭代建议
- 接入真实 Cloudflare Turnstile（替换测试 Key）
- 补充前端组件测试（@testing-library/react）
- 实现会员付费接入（当前为管理员手动开通模式）
- 完成 P2 功能（告警图表、批量操作、审计日志）

---

## 八、项目结构总览

```
D:\pir\
├── deliverables\workbody\        # 交付文档
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── class-diagram.mermaid
│   └── sequence-diagram.mermaid
└── workbody\                     # 项目代码
    ├── server\                   # 后端（72 文件）
    │   ├── prisma\               # 数据库 schema + seed
    │   ├── src\
    │   │   ├── config\           # 配置加载
    │   │   ├── modules\          # 8 大业务模块
    │   │   ├── middlewares\      # 5 大中间件
    │   │   ├── utils\            # jwt/bcrypt/crypto/logger/response
    │   │   ├── jobs\             # 定时任务
    │   │   └── types\
    │   ├── tests\                # 9 个测试文件（97 用例）
    │   └── deploy\               # 部署文档 + Nginx 配置
    └── web\                      # 前端（46 文件）
        └── src\
            ├── api\              # axios + 6 API 模块
            ├── components\       # Layout + common + device
            ├── pages\            # auth + 用户端 + admin
            ├── hooks\            # 5 个自定义 Hook
            ├── store\            # Zustand 状态管理
            ├── types\
            └── utils\            # constants/format/validators
```

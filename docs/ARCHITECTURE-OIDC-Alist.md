# 架构设计 — pir-cloud OIDC 一键登录 & Alist 固件分发

> 配套文档：[PRD-OIDC-Alist.md](./PRD-OIDC-Alist.md)
> 架构师：高见远（Gao）
> 技术栈：后端 Node.js + Fastify + Prisma + MySQL；前端 React + MUI + Vite + Zustand

---

## 0. 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         浏览器 / 设备 OTA                          │
└──────────┬───────────────────────────────┬───────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────────────────┐
│  pir-cloud 前端      │         │  pir-cloud 后端 (Fastify)        │
│  React + MUI        │         │                                 │
│                     │  HTTPS  │  /api/auth/oidc/login   ──┐     │
│  LoginPage          │ ◄─────► │  /api/auth/oidc/callback │     │
│  OidcCallbackPage   │         │  /api/auth/bind-email    │     │
│  BindEmailPage      │         │  /api/firmware/download/*│     │
│  AuthGuard          │         │  /api/admin/firmware/*   │     │
└─────────────────────┘         └──────────┬──────────────┬────────┘
                                           │              │
                      ┌────────────────────┘              │
                      ▼                                   ▼
          ┌──────────────────────┐         ┌────────────────────────┐
          │  Xiaoyu OIDC Provider │         │  Alist (雨云 S3 网关)   │
          │  auth.xiaoyyua.top    │         │  alist.xiaoyyua.top    │
          │  /authorize           │         │  PUT /api/fs/put        │
          │  /token (PKCE S256)   │         │  POST /api/fs/get       │
          │  /me (UserInfo)       │         │  POST /api/fs/remove    │
          └──────────────────────┘         └────────────────────────┘
                                                     │
                                                     ▼
                                         ┌────────────────────────┐
                                         │  雨云对象存储 (S3)       │
                                         │  /alist1/guest/pir_download/
                                         └────────────────────────┘
```

### 核心设计原则

1. **OIDC 全程 PKCE + state**：code_verifier / state 存放于签名 HTTP-only Cookie（10 分钟有效），无需 Redis/DB 存储，重启不丢失上下文。
2. **Alist 作为存储抽象层**：后端通过 `AlistService` 封装所有对象存储操作，业务层不感知存储细节；下载默认 302 重定向直链（减少服务器带宽），代理模式作为可选 fallback。
3. **零破坏性 Schema 变更**：仅新增字段（`email_verified` / `oidc_sub`）和枚举值（`bind_email`），所有新字段均有默认值，老数据零迁移。
4. **AuthGuard 单点拦截**：在路由守卫统一判断 `email_verified`，未绑定邮箱的用户除 `/bind-email` 外全部重定向，前后端双重保障。

---

## 1. 文件列表（新建 / 修改，按模块分组）

### 1.1 后端 — 新建文件

| # | 文件路径 | 说明 |
|---|---------|------|
| 1 | `server/src/modules/oidc/oidc.service.ts` | OIDC 核心服务：PKCE 生成、授权 URL 构造、token 交换、UserInfo 获取、用户匹配/注册 |
| 2 | `server/src/modules/oidc/oidc.controller.ts` | OIDC 控制器：`loginHandler`（302 跳转）、`callbackHandler`（回调处理） |
| 3 | `server/src/modules/oidc/oidc.routes.ts` | OIDC 路由注册 |
| 4 | `server/src/modules/oidc/oidc.types.ts` | OIDC 类型定义（PKCE、TokenResponse、UserInfo） |
| 5 | `server/src/modules/alist/alist.service.ts` | Alist API 客户端封装：upload / getDownloadUrl / delete / exists / mkdir |
| 6 | `server/src/modules/alist/alist.types.ts` | Alist API 响应类型定义 |
| 7 | `server/src/scripts/migrate-firmware-to-alist.ts` | 一次性迁移脚本：将本地 `firmware_store/` 已有固件上传至 Alist |
| 8 | `server/prisma/migrations/<timestamp>_add_oidc_alist_fields/migration.sql` | Prisma 自动生成的迁移 SQL |

### 1.2 后端 — 修改文件

| # | 文件路径 | 修改内容 |
|---|---------|---------|
| 9 | `server/prisma/schema.prisma` | User 模型新增 `email_verified` / `oidc_sub` 字段；`VerificationCodeType` 枚举新增 `bind_email` |
| 10 | `server/src/config/index.ts` | 新增 `oidc` 和 `alist` 配置块 |
| 11 | `server/.env.example` | 新增 OIDC / Alist 环境变量示例 |
| 12 | `server/src/modules/auth/auth.service.ts` | `toUserPublicInfo` 输出 `emailVerified` / `oidcSub`；`sendVerificationCode` 支持 `bind_email`；新增 `bindEmail(userId, email, code)` 方法 |
| 13 | `server/src/modules/auth/auth.controller.ts` | 新增 `bindEmailHandler`；`sendCodeHandler` 的 type 联合类型加入 `bind_email` |
| 14 | `server/src/modules/auth/auth.routes.ts` | 注册 `POST /api/auth/bind-email` 路由（需鉴权） |
| 15 | `server/src/modules/auth/auth.schema.ts` | `sendCodeSchema` 的 type enum 加入 `bind_email`；新增 `bindEmailSchema` |
| 16 | `server/src/modules/index.ts` | 注册 `oidcRoutes` |
| 17 | `server/src/modules/firmware/firmware.controller.ts` | `downloadLatestHandler` / `downloadByVersionHandler`：`fs.readFileSync` → `alistService.getDownloadUrl` + 302 重定向 |
| 18 | `server/src/modules/firmware/firmware.service.ts` | `resolveDiskPath` 改为 `resolveRemotePath`（返回 Alist 完整路径） |
| 19 | `server/src/modules/admin/firmware/firmware.service.ts` | `uploadFirmware`：`fs.writeFileSync` → `alistService.uploadFile`；`deleteFirmware`：`fs.unlinkSync` → `alistService.deleteFile`；移除 `ensureStoreDir` / `storeDir` |
| 20 | `server/src/modules/admin/firmware/firmware.controller.ts` | `downloadFirmwareHandler`：`fs.readFileSync` → 302 重定向 |
| 21 | `server/src/modules/qq-verify/qq-verify.service.ts` | `requestCode` 的 premium 校验改为 `canVerifyQq()`：premium 会员 **或** OIDC 注册用户（`oidc_sub IS NOT NULL`）均可验证 |
| 22 | `server/src/types/index.ts` | `UserPublicInfo` 新增 `emailVerified: boolean` / `oidcSub: string \| null`；`VerificationCodeType` 新增 `bind_email` |
| 23 | `server/src/middlewares/auth.middleware.ts` | `select` 增加 `email_verified` / `oidc_sub`；`AuthUser` 类型同步（可选，按需） |

### 1.3 前端 — 新建文件

| # | 文件路径 | 说明 |
|---|---------|------|
| 24 | `web/src/pages/auth/OidcCallbackPage.tsx` | OIDC 回调处理页：解析 code+state，POST 后端回调，loading/error 状态 |
| 25 | `web/src/pages/auth/BindEmailPage.tsx` | 绑定邮箱页：邮箱输入 + 验证码发送 + 验证 + 绑定 |
| 26 | `web/src/api/oidc.api.ts` | OIDC 相关 API 封装（callback 请求） |

### 1.4 前端 — 修改文件

| # | 文件路径 | 修改内容 |
|---|---------|---------|
| 27 | `web/src/utils/constants.ts` | `ROUTE_PATHS` 新增 `OIDC_CALLBACK: '/auth/oidc/callback'` / `BIND_EMAIL: '/bind-email'` |
| 28 | `web/src/types/index.ts` | `UserPublicInfo` 新增 `emailVerified` / `oidcSub`；`VerificationCodeType` 新增 `bind_email` |
| 29 | `web/src/App.tsx` | 注册 `/auth/oidc/callback` 和 `/bind-email` 路由 |
| 30 | `web/src/components/Layout/AuthGuard.tsx` | 新增 `email_verified === false` 拦截逻辑：非 `/bind-email` 路由重定向至 `/bind-email` |
| 31 | `web/src/pages/auth/LoginPage.tsx` | 邮箱密码表单下方新增分割线 + "QQ 一键登录"按钮（点击 `window.location.href = '/api/auth/oidc/login'`） |
| 32 | `web/src/api/auth.api.ts` | `sendCode` 的 type 联合类型加入 `bind_email`；新增 `bindEmail(email, code)` 函数 |
| 33 | `web/src/store/auth.store.ts` | 无需改动（`user` 类型自动跟随 `UserPublicInfo`） |

---

## 2. Prisma Schema 变更

### 2.1 User 模型新增字段

```prisma
model User {
  // ... 现有字段保持不变 ...
  email_verified   Boolean  @default(true)    // 新增：邮箱是否已验证（邮箱密码注册的老用户为 true；OIDC 新用户为 false）
  oidc_sub         String?  @db.VarChar(128)  // 新增：OIDC Provider 返回的 sub 标识（唯一标识 OIDC 用户）
  // ... 现有关系保持不变 ...

  @@index([oidc_sub])  // 新增：按 oidc_sub 快速查找
  @@map("users")
}
```

**说明**：
- `email_verified @default(true)`：保证老用户（邮箱密码注册）默认为 `true`，不受影响。
- `oidc_sub` 可空：仅 OIDC 注册的新用户有值；老用户即使后续绑定 OIDC 也会填充此字段。
- `oidc_sub` 加索引：OIDC 回调时通过 `sub` 快速查找用户。

### 2.2 VerificationCodeType 枚举新增

```prisma
enum VerificationCodeType {
  register
  reset_password
  bind_email        // 新增：绑定邮箱验证码
}
```

### 2.3 迁移命令

```bash
cd server
npx prisma migrate dev --name add_oidc_alist_fields
npx prisma generate
```

### 2.4 老数据兼容

- `email_verified` 默认 `true`：所有现有用户视为已验证，不受 AuthGuard 拦截。
- `oidc_sub` 默认 `null`：现有用户未关联 OIDC。
- `bind_email` 枚举值：不影响现有验证码记录。

---

## 3. 新增 API 端点

### 3.1 OIDC 认证端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/auth/oidc/login` | 无 | 生成 PKCE code_verifier/code_challenge + state，写入签名 Cookie（10min），302 重定向至 OIDC `/authorize` |
| `GET` | `/api/auth/oidc/callback` | 无 | 接收 `code` + `state`，校验 state（Cookie 对比），用 code+code_verifier 换 access_token，请求 UserInfo，匹配/注册用户，签发 pir-cloud JWT，302 重定向至前端 `/auth/oidc/callback?tokens=...` |

**`GET /api/auth/oidc/login` 响应流程**：

```
1. 生成 code_verifier = base64url(random(32 bytes))
2. code_challenge = base64url(SHA256(code_verifier))   // S256
3. state = base64url(random(16 bytes))
4. Set-Cookie: oidc_pkce=<signed(code_verifier|state)>; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/
5. 302 → https://auth.xiaoyyua.top/authorize?
     response_type=code
     &client_id=pir-cloud
     &redirect_uri=https://pir.xiaoyyua.top/api/auth/oidc/callback
     &scope=openid+profile+qq
     &state=<state>
     &code_challenge=<code_challenge>
     &code_challenge_method=S256
```

**`GET /api/auth/oidc/callback` 响应流程**：

```
1. 从 Cookie 读取 oidc_pkce，验签解出 code_verifier + state
2. 校验 query.state === cookie.state（不匹配 → 400 错误页）
3. 清除 oidc_pkce Cookie
4. POST https://auth.xiaoyyua.top/token
     Body: grant_type=authorization_code
           &code=<code>
           &redirect_uri=<redirect_uri>
           &client_id=pir-cloud
           &client_secret=<client_secret>
           &code_verifier=<code_verifier>
   → 返回 { access_token, id_token, token_type: "Bearer", expires_in }
5. GET https://auth.xiaoyyua.top/me
     Header: Authorization: Bearer <access_token>
   → 返回 { sub, nickname, qq }
6. 用户匹配逻辑（见 §7.3）：
   - 先按 oidc_sub 查找（已关联的老用户）
   - 再按 qq_number 查找（未关联但 QQ 号匹配的老用户）
   - 都未命中 → 自动注册新用户
7. 签发 pir-cloud JWT 双 Token（复用 authService.generateTokens）
8. 302 重定向至前端：
   https://pir.xiaoyyua.top/auth/oidc/callback#access_token=<jwt>&refresh_token=<jwt>&email_verified=<bool>
   （用 URL fragment 避免 token 出现在服务器日志和 referer 头）
```

### 3.2 邮箱绑定端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/send-code` | 无（现有，type 扩展） | 发送验证码，type 新增 `bind_email`（需登录态调用，但端点本身无 authMiddleware） |
| `POST` | `/api/auth/bind-email` | 需登录（authMiddleware） | 绑定邮箱：校验 `bind_email` 验证码，更新 `email` + `email_verified=true`，返回最新用户信息 |

**`POST /api/auth/bind-email` 请求体**：

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**响应**：

```json
{
  "code": 0,
  "message": "邮箱绑定成功",
  "data": {
    "user": {
      "id": 42,
      "email": "user@example.com",
      "emailVerified": true,
      "oidcSub": "abc123...",
      ...
    }
  }
}
```

**业务逻辑**：
1. 校验验证码（type=`bind_email`，未过期，未使用）
2. 检查邮箱是否已被其他用户占用（`email @unique` 约束）
3. 更新用户：`email = 新邮箱`，`email_verified = true`
4. 标记验证码为已使用
5. 返回最新用户信息（前端更新 store）

### 3.3 现有端点变更

| 方法 | 路径 | 变更 |
|------|------|------|
| `POST` | `/api/auth/send-code` | `type` 字段 enum 新增 `bind_email` |
| `GET` | `/api/firmware/download/latest` | `fs.readFileSync` → 302 重定向至 Alist 直链 |
| `GET` | `/api/firmware/download/:version` | 同上 |
| `GET` | `/api/admin/firmware/:id/download` | 同上 |
| `POST` | `/api/admin/firmware/upload` | `fs.writeFileSync` → `alistService.uploadFile` |
| `DELETE` | `/api/admin/firmware/:id` | `fs.unlinkSync` → `alistService.deleteFile` |

---

## 4. 新增前端路由和页面

### 4.1 新增路由

| 路径 | 组件 | 鉴权 | 说明 |
|------|------|------|------|
| `/auth/oidc/callback` | `OidcCallbackPage` | 无 | OIDC 回调处理：解析 URL fragment 中的 tokens，存入 authStore，根据 `email_verified` 跳转 |
| `/bind-email` | `BindEmailPage` | 需登录 | 绑定邮箱页：未绑定邮箱用户专属，AuthGuard 拦截跳转至此 |

### 4.2 路由注册（App.tsx）

```tsx
// 新增导入
import OidcCallbackPage from './pages/auth/OidcCallbackPage';
import BindEmailPage from './pages/auth/BindEmailPage';

// 在 Routes 内新增（公开路由，不包 AuthGuard）
<Route path={ROUTE_PATHS.OIDC_CALLBACK} element={<OidcCallbackPage />} />

// 在 Routes 内新增（需登录但不要求 emailVerified —— AuthGuard 特殊放行）
<Route
  path={ROUTE_PATHS.BIND_EMAIL}
  element={
    <AuthGuard>
      <BindEmailPage />
    </AuthGuard>
  }
/>
```

### 4.3 AuthGuard 改造

```tsx
export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  // 1. 未登录 → 跳登录
  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} state={{ from: location }} replace />;
  }

  // 2. 未绑定邮箱 → 跳绑定邮箱页（/bind-email 自身放行）
  if (user && !user.emailVerified && location.pathname !== ROUTE_PATHS.BIND_EMAIL) {
    return <Navigate to={ROUTE_PATHS.BIND_EMAIL} replace />;
  }

  // 3. 管理员权限校验
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
```

### 4.4 constants.ts 新增

```typescript
export const ROUTE_PATHS = {
  // ... 现有 ...
  OIDC_CALLBACK: '/auth/oidc/callback',
  BIND_EMAIL: '/bind-email',
} as const;

// QQ 一键登录入口（后端 302 跳转）
export const OIDC_LOGIN_URL = '/api/auth/oidc/login';

// QQ 品牌色
export const QQ_BRAND_COLOR = '#12B7F5';
```

---

## 5. 任务列表（有序、含依赖关系，按实现顺序排列）

> 任务编号格式：`T<序号>`。依赖关系用 `← T<x>` 表示"依赖于任务 T<x>"。

### 阶段一：基础设施（无依赖，可并行）

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T1** | Prisma Schema 变更：新增 `email_verified` / `oidc_sub` 字段 + `bind_email` 枚举，运行 `prisma migrate dev` + `prisma generate` | 无 | `schema.prisma`, migration SQL |
| **T2** | 后端配置：`config/index.ts` 新增 `oidc` / `alist` 配置块；更新 `.env.example` | 无 | `config/index.ts`, `.env.example` |
| **T3** | 后端类型：`types/index.ts` 的 `UserPublicInfo` 新增 `emailVerified` / `oidcSub`；`VerificationCodeType` 新增 `bind_email` | ← T1 | `types/index.ts` |
| **T4** | 前端类型与常量：`types/index.ts` + `constants.ts` 新增字段和路由 | 无 | `web/src/types/index.ts`, `web/src/utils/constants.ts` |

### 阶段二：Alist 模块（独立模块，可并行于 OIDC）

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T5** | 新建 Alist 模块：`alist.service.ts`（upload/getDownloadUrl/delete/exists/mkdir）+ `alist.types.ts` | ← T2 | `modules/alist/*` |
| **T6** | 改造管理员固件上传：`admin/firmware/firmware.service.ts` 的 `uploadFirmware` 用 `alistService.uploadFile` 替换 `fs.writeFileSync` | ← T5 | `admin/firmware/firmware.service.ts` |
| **T7** | 改造管理员固件删除：`firmware.service.ts` 的 `deleteFirmware` 用 `alistService.deleteFile` 替换 `fs.unlinkSync` | ← T5 | `admin/firmware/firmware.service.ts` |
| **T8** | 改造公开固件下载：`firmware/firmware.controller.ts` 的 `downloadLatestHandler` / `downloadByVersionHandler` 改为 302 重定向 | ← T5 | `firmware/firmware.controller.ts`, `firmware.service.ts` |
| **T9** | 改造管理员固件下载：`admin/firmware/firmware.controller.ts` 的 `downloadFirmwareHandler` 改为 302 重定向 | ← T5 | `admin/firmware/firmware.controller.ts` |
| **T10** | 编写并执行固件迁移脚本：将本地 `firmware_store/` 现有固件（如 `1782411782746_913c4b27_firmware.bin`）上传至 Alist | ← T5, T6 | `scripts/migrate-firmware-to-alist.ts` |

### 阶段三：OIDC 模块

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T11** | 新建 OIDC 模块：`oidc.service.ts`（PKCE 生成、授权 URL、token 交换、UserInfo 获取、用户匹配/注册）+ `oidc.types.ts` | ← T2, T3 | `modules/oidc/oidc.service.ts`, `oidc.types.ts` |
| **T12** | 新建 OIDC 控制器与路由：`oidc.controller.ts`（loginHandler / callbackHandler）+ `oidc.routes.ts`；在 `modules/index.ts` 注册 | ← T11 | `modules/oidc/oidc.controller.ts`, `oidc.routes.ts`, `modules/index.ts` |

### 阶段四：邮箱绑定模块

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T13** | 后端邮箱绑定：`auth.service.ts` 新增 `bindEmail` 方法；`sendVerificationCode` 支持 `bind_email`；`auth.controller.ts` 新增 `bindEmailHandler`；`auth.schema.ts` 新增 schema；`auth.routes.ts` 注册路由 | ← T1, T3 | `auth.service.ts`, `auth.controller.ts`, `auth.schema.ts`, `auth.routes.ts` |
| **T14** | 后端 `auth.service.ts` 的 `toUserPublicInfo` 输出 `emailVerified` / `oidcSub`；`auth.middleware.ts` 同步 select 字段 | ← T3 | `auth.service.ts`, `auth.middleware.ts` |

### 阶段五：QQ 验证限制放开

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T15** | 修改 `qq-verify.service.ts`：`requestCode` 的 premium 校验改为 `canVerifyQq()`，premium 会员 **或** OIDC 注册用户（`oidc_sub IS NOT NULL`）可验证 | ← T1 | `qq-verify.service.ts` |

### 阶段六：前端改造

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T16** | 前端 AuthGuard 改造：新增 `email_verified` 拦截逻辑 | ← T4 | `AuthGuard.tsx` |
| **T17** | 前端登录页改造：`LoginPage.tsx` 新增"QQ 一键登录"按钮 | ← T4 | `LoginPage.tsx` |
| **T18** | 前端 OIDC 回调页：新建 `OidcCallbackPage.tsx` + `oidc.api.ts`；App.tsx 注册路由 | ← T4, T12 | `OidcCallbackPage.tsx`, `oidc.api.ts`, `App.tsx` |
| **T19** | 前端绑定邮箱页：新建 `BindEmailPage.tsx`；`auth.api.ts` 新增 `bindEmail`；App.tsx 注册路由 | ← T4, T13, T16 | `BindEmailPage.tsx`, `auth.api.ts`, `App.tsx` |

### 阶段七：联调与验收

| 任务 | 描述 | 依赖 | 文件 |
|------|------|------|------|
| **T20** | 端到端联调：OIDC 登录全流程（老用户/新用户）+ 邮箱绑定 + 固件上传/下载/删除 + 迁移验证 | ← T10, T12, T13, T15, T19 | — |

### 任务依赖关系图

```
T1 ─┬─→ T3 ──→ T14 ──┐
    ├─→ T13 ──→ T19   ├─→ T20
    └─→ T15           │
                     │
T2 ─┬─→ T5 ─┬─→ T6   │
    │       ├─→ T7   │
    │       ├─→ T8   │
    │       ├─→ T9   │
    │       └─→ T10──┤
    │                │
    └─→ T11 ─→ T12 ──┤
                     │
T4 ─┬─→ T16 ──┐      │
    ├─→ T17   │      │
    ├─→ T18 ──┼──────┤
    └─→ T19 ──┘      │
                     ↓
                    T20
```

### 并行执行建议

- **第一批并行**：T1, T2, T4（无依赖）
- **第二批并行**：T3（←T1）, T5（←T2）, T15（←T1）
- **第三批并行**：T6/T7/T8/T9/T10（←T5）, T11（←T2,T3）, T13/T14（←T1,T3）
- **第四批并行**：T12（←T11）, T16/T17（←T4）
- **第五批并行**：T18（←T4,T12）, T19（←T4,T13,T16）
- **最终**：T20（全部完成）

---

## 6. 依赖包列表

### 6.1 后端新增依赖

| 包名 | 版本 | 用途 | 备注 |
|------|------|------|------|
| 无新增 | — | — | 复用现有 `axios`（HTTP 请求）、`crypto`（Node 内置，PKCE/SHA256）|

**说明**：OIDC 流程仅需 HTTP 请求（`axios` 已有）+ PKCE 生成（`crypto.randomBytes` + `crypto.createHash('sha256')`，Node 内置），Alist API 调用也仅需 `axios`。**无需引入 `openid-client` 等重型 OIDC 库**，手写 PKCE + token exchange 代码量小、可控性强、避免额外依赖。

### 6.2 前端新增依赖

| 包名 | 版本 | 用途 | 备注 |
|------|------|------|------|
| 无新增 | — | — | 复用现有 `axios`、`@mui/material`、`react-router-dom` |

### 6.3 环境变量新增

```bash
# ===== OIDC =====
OIDC_ISSUER=https://auth.xiaoyyua.top
OIDC_CLIENT_ID=pir-cloud
OIDC_CLIENT_SECRET=5a623d9af2e489b22344f1cc606b4afa
OIDC_REDIRECT_URI=https://pir.xiaoyyua.top/api/auth/oidc/callback
OIDC_SCOPES=openid profile qq

# ===== Alist =====
ALIST_BASE_URL=https://alist.xiaoyyua.top
ALIST_API_TOKEN=openlist-80a43f35-c303-4d62-bd76-9e23d29833a5rn1vyTvIn2a06fEOaaUtdGMwXUReL3sW6gO6fobKMNrmRufbIAHPpY8ZIJJrFLM0
ALIST_FIRMWARE_PATH=/S3-Rainyun-18376752486(11323)/alist1/guest/pir_download
```

---

## 7. 关键实现要点

### 7.1 PKCE 生成（S256）

```typescript
// server/src/modules/oidc/oidc.service.ts
import crypto from 'crypto';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 生成 PKCE code_verifier（43-128 字符的随机字符串） */
function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32));
}

/** 从 code_verifier 计算 code_challenge（S256 方法） */
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64url(hash);
}

/** 生成 state（16 字节随机） */
function generateState(): string {
  return base64url(crypto.randomBytes(16));
}
```

### 7.2 OIDC state 存储（签名 Cookie）

**方案**：将 `code_verifier` 和 `state` 拼接为 `code_verifier|state`，用 JWT 签名后存入 HTTP-only Cookie。

**理由**：
- 无需 Redis/DB 等额外存储
- 签名防篡改，验证 state 时自动校验签名
- Cookie 随回调请求自动携带（同域 `pir.xiaoyyua.top`）
- 10 分钟短有效期，过期自动失效

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../../config/index';

const COOKIE_NAME = 'oidc_pkce';
const COOKIE_MAX_AGE = 600; // 10 分钟

/** 签名并写入 Cookie */
function setOidcCookie(reply: FastifyReply, codeVerifier: string, state: string): void {
  const payload = { codeVerifier, state };
  const token = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '10m' });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/** 读取并验签 Cookie */
function readOidcCookie(request: FastifyRequest): { codeVerifier: string; state: string } | null {
  const token = request.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwt.accessSecret) as { codeVerifier: string; state: string };
  } catch {
    return null;
  }
}

/** 清除 Cookie */
function clearOidcCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}
```

**注意**：Fastify 需注册 `@fastify/cookie` 插件。需检查是否已注册（如未注册需安装并注册）。

### 7.3 用户匹配/注册逻辑

```typescript
// server/src/modules/oidc/oidc.service.ts

interface OidcUserInfo {
  sub: string;
  nickname: string | null;
  qq: string | null;
}

async function matchOrCreateUser(userInfo: OidcUserInfo): Promise<User> {
  // 1. 优先按 oidc_sub 查找（已关联的老用户再次 OIDC 登录）
  let user = await prisma.user.findFirst({
    where: { oidc_sub: userInfo.sub },
  });

  if (user) return user;

  // 2. 按 qq_number 查找（未关联但 QQ 号匹配的老用户，首次 OIDC 登录）
  if (userInfo.qq) {
    user = await prisma.user.findFirst({
      where: { qq_number: userInfo.qq },
    });
    if (user) {
      // 关联 oidc_sub，后续 OIDC 登录直接命中
      await prisma.user.update({
        where: { id: user.id },
        data: { oidc_sub: userInfo.sub },
      });
      return user;
    }
  }

  // 3. 未命中 → 自动注册新用户
  const placeholderEmail = `oidc_${userInfo.sub}@placeholder.pir-cloud.local`;
  const randomPassword = crypto.randomBytes(32).toString('hex'); // 不可用于密码登录
  const nickname = userInfo.nickname || `QQ用户_${(userInfo.qq || '').slice(-4)}`;

  user = await prisma.user.create({
    data: {
      email: placeholderEmail,
      password: await hashPassword(randomPassword),
      nickname,
      qq_number: userInfo.qq,
      qq_verified: false,
      email_verified: false, // 标记未绑定真实邮箱
      oidc_sub: userInfo.sub,
      membership_level: 'free',
    },
  });

  return user;
}
```

### 7.4 Alist API 封装

```typescript
// server/src/modules/alist/alist.service.ts
import axios from 'axios';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

export class AlistService {
  private get headers() {
    return { Authorization: config.alist.apiToken };
  }

  private get basePath() {
    return config.alist.firmwareBasePath; // /S3-Rainyun-18376752486(11323)/alist1/guest/pir_download
  }

  /** 构造 Alist 中的完整文件路径 */
  buildRemotePath(diskFilename: string): string {
    return `${this.basePath}/${diskFilename}`;
  }

  /** 上传文件到 Alist（PUT /api/fs/put） */
  async uploadFile(diskFilename: string, buffer: Buffer): Promise<void> {
    const filePath = this.buildRemotePath(diskFilename);
    await axios.put(`${config.alist.baseUrl}/api/fs/put`, buffer, {
      headers: {
        ...this.headers,
        'File-Path': encodeURIComponent(filePath),
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buffer.length),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    logger.info({ filePath, size: buffer.length }, 'Alist file uploaded');
  }

  /** 获取文件下载直链（POST /api/fs/get 返回 raw_url） */
  async getDownloadUrl(diskFilename: string): Promise<string | null> {
    const filePath = this.buildRemotePath(diskFilename);
    const res = await axios.post(
      `${config.alist.baseUrl}/api/fs/get`,
      { path: filePath },
      { headers: this.headers },
    );
    if (res.data?.code !== 200 || !res.data?.data?.raw_url) {
      return null;
    }
    return res.data.data.raw_url;
  }

  /** 删除文件（POST /api/fs/remove） */
  async deleteFile(diskFilename: string): Promise<void> {
    const filePath = this.buildRemotePath(diskFilename);
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    await axios.post(
      `${config.alist.baseUrl}/api/fs/remove`,
      { dir: dirPath, names: [diskFilename] },
      { headers: this.headers },
    );
    logger.info({ filePath }, 'Alist file deleted');
  }

  /** 检查文件是否存在 */
  async fileExists(diskFilename: string): Promise<boolean> {
    const filePath = this.buildRemotePath(diskFilename);
    try {
      const res = await axios.post(
        `${config.alist.baseUrl}/api/fs/get`,
        { path: filePath },
        { headers: this.headers },
      );
      return res.data?.code === 200;
    } catch {
      return false;
    }
  }

  /** 确保目录存在 */
  async mkdir(dirPath: string): Promise<void> {
    await axios.post(
      `${config.alist.baseUrl}/api/fs/mkdir`,
      { path: dirPath },
      { headers: this.headers },
    );
  }
}

export const alistService = new AlistService();
```

### 7.5 固件下载 302 重定向

```typescript
// server/src/modules/firmware/firmware.controller.ts（改造后）
import { alistService } from '../alist/alist.service';

export async function downloadLatestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const fw = await firmwareService.getLatestRecord();
    if (!fw) {
      reply.status(404).send({ code: 4001, message: '暂无可用固件', data: null });
      return;
    }

    const downloadUrl = await alistService.getDownloadUrl(fw.disk_filename);
    if (!downloadUrl) {
      reply.status(404).send({ code: 4001, message: '固件文件不存在', data: null });
      return;
    }

    // 302 重定向到 Alist 直链
    reply.redirect(302, downloadUrl);
  } catch (err: any) {
    reply.status(err.statusCode || 500).send({
      code: err.code || 5001,
      message: err.message || '服务器内部错误',
      data: null,
    });
  }
}
```

### 7.6 邮箱绑定流程

```typescript
// server/src/modules/auth/auth.service.ts（新增方法）

async bindEmail(userId: number, email: string, code: string): Promise<UserPublicInfo> {
  // 1. 校验验证码（type=bind_email）
  await this.verifyCode(email, code, 'bind_email');

  // 2. 检查邮箱是否已被其他用户占用
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    const error = new Error('邮箱已被其他账号占用');
    (error as any).code = 1003;
    (error as any).statusCode = 409;
    throw error;
  }

  // 3. 更新用户邮箱 + 标记已验证
  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      email_verified: true,
    },
  });

  // 4. 标记验证码已使用
  await prisma.verificationCode.updateMany({
    where: { email, code, type: 'bind_email', used: false },
    data: { used: true },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');

  logger.info({ userId, email }, 'Email bound successfully');
  return toUserPublicInfo(user);
}
```

### 7.7 QQ 验证限制放开

```typescript
// server/src/modules/qq-verify/qq-verify.service.ts（改造后）

/**
 * 判断用户是否有权发起 QQ 验证
 * - premium 会员（未过期）可验证
 * - OIDC 注册用户（oidc_sub IS NOT NULL）可免费验证
 */
private async canVerifyQq(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      membership_level: true,
      membership_expire_at: true,
      oidc_sub: true,
    },
  });
  if (!user) return false;

  // OIDC 注册用户
  if (user.oidc_sub) return true;

  // premium 会员（未过期）
  const isPremium =
    user.membership_level === 'premium' &&
    (!user.membership_expire_at || user.membership_expire_at > new Date());
  return isPremium;
}

async requestCode(userId: number, qqNumber: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      membership_level: true,
      membership_expire_at: true,
      qq_number: true,
      oidc_sub: true,
    },
  });

  if (!user) { /* ... */ }

  // 改造点：用 canVerifyQq 替代直接检查 premium
  const canVerify = await this.canVerifyQq(userId);
  if (!canVerify) {
    const error = new Error('仅付费会员或 OIDC 注册用户可进行 QQ 验证');
    (error as any).code = 3002;
    (error as any).statusCode = 403;
    throw error;
  }

  // ... 后续逻辑不变 ...
}
```

### 7.8 AuthGuard 改造

见 §4.3。

### 7.9 OIDC 回调 Token 传递（安全考虑）

后端 `GET /api/auth/oidc/callback` 完成登录后，需将 JWT 传递给前端。**采用 URL fragment**（非 query string）：

```
302 → https://pir.xiaoyyua.top/auth/oidc/callback#access_token=<jwt>&refresh_token=<jwt>&email_verified=false
```

**理由**：
- Fragment（`#` 后部分）不会发送到服务器，不出现在服务器日志
- 不会出现在 `Referer` 头中
- 浏览器不会缓存 fragment
- 前端 `OidcCallbackPage` 用 `window.location.hash` 解析

```typescript
// web/src/pages/auth/OidcCallbackPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { useAuthStore } from '../../store/auth.store';
import { ROUTE_PATHS } from '../../utils/constants';

export default function OidcCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    // 解析 URL fragment
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const emailVerified = params.get('email_verified') === 'true';
    const errorMsg = params.get('error');

    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      return;
    }

    if (!accessToken || !refreshToken) {
      setError('回调参数缺失');
      return;
    }

    // 从 access_token 解析用户信息（或请求 /api/auth/me）
    // 这里先请求 /api/auth/me 获取完整用户信息
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.code !== 0) throw new Error(res.message);
        setAuth(accessToken, refreshToken, res.data.user);
        // 清除 URL fragment
        window.history.replaceState({}, '', ROUTE_PATHS.DASHBOARD);
        navigate(emailVerified ? ROUTE_PATHS.DASHBOARD : ROUTE_PATHS.BIND_EMAIL, { replace: true });
      })
      .catch((err) => setError(err.message || '登录失败'));
  }, [navigate, setAuth]);

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button variant="contained" href={ROUTE_PATHS.LOGIN}>返回登录</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <CircularProgress />
      <Typography>正在登录...</Typography>
      <Typography variant="body2" color="text.secondary">请稍候，正在处理登录信息</Typography>
    </Box>
  );
}
```

### 7.10 固件迁移脚本

```typescript
// server/src/scripts/migrate-firmware-to-alist.ts
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { alistService } from '../modules/alist/alist.service';
import { config } from '../config/index';

async function main() {
  const storeDir = config.firmware.storeDir;
  const files = fs.readdirSync(storeDir).filter((f) => f.endsWith('.bin'));

  console.log(`Found ${files.length} firmware files to migrate`);

  for (const filename of files) {
    const fullPath = path.join(storeDir, filename);
    const buffer = fs.readFileSync(fullPath);

    // 检查 Alist 是否已存在
    const exists = await alistService.fileExists(filename);
    if (exists) {
      console.log(`SKIP: ${filename} (already exists in Alist)`);
      continue;
    }

    await alistService.uploadFile(filename, buffer);
    console.log(`UPLOADED: ${filename} (${buffer.length} bytes)`);

    // 验证数据库记录存在
    const record = await prisma.firmwareVersion.findFirst({
      where: { disk_filename: filename },
    });
    if (!record) {
      console.warn(`WARN: ${filename} not found in database`);
    }
  }

  console.log('Migration completed');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

**运行**：

```bash
cd server
npx ts-node src/scripts/migrate-firmware-to-alist.ts
```

### 7.11 Fastify Cookie 插件

需确认 `@fastify/cookie` 是否已安装注册。如未安装：

```bash
cd server
npm install @fastify/cookie
```

在 `server/src/config/fastify.ts` 中注册：

```typescript
import cookie from '@fastify/cookie';

// 在 buildApp 中
await app.register(cookie, {
  secret: config.jwt.accessSecret, // 用于签名 Cookie
});
```

### 7.12 OIDC Discovery（可选优化，P1）

启动时请求 `https://auth.xiaoyyua.top/.well-known/openid-configuration` 自动获取端点地址：

```typescript
// server/src/modules/oidc/oidc.service.ts
let discoveryCache: { authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string } | null = null;

async function getDiscovery() {
  if (discoveryCache) return discoveryCache;
  const res = await axios.get(`${config.oidc.issuer}/.well-known/openid-configuration`);
  discoveryCache = res.data;
  return discoveryCache;
}
```

P0 阶段可硬编码端点（`/authorize`、`/token`、`/me`），P1 再加 discovery。

---

## 8. 安全检查清单

- [x] PKCE S256：code_verifier 32 字节随机，code_challenge = SHA256(code_verifier)
- [x] state：16 字节随机，签名 Cookie 存储，回调校验
- [x] Cookie：HttpOnly + Secure（生产）+ SameSite=Lax，10 分钟过期
- [x] client_secret 仅在后端使用，不暴露给前端
- [x] Token 传递用 URL fragment，不出现在服务器日志/Referer
- [x] 邮箱绑定验证码：6 位，5 分钟有效，60 秒防重发
- [x] 邮箱唯一性校验：绑定前检查 email 不被其他用户占用
- [x] OIDC 新用户密码随机生成（不可用于密码登录）
- [x] Alist API Token 仅在后端使用，不暴露给前端
- [x] 固件下载 302 重定向直链（固件非敏感，直链高效）

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Alist API 不可用 | 固件上传/下载失败 | P1：上传重试 3 次；P2：本地 fallback |
| OIDC Provider 不可用 | 无法 QQ 登录 | 前端回调页显示错误 + 返回登录按钮；邮箱密码登录不受影响 |
| 占位邮箱冲突 | `email @unique` 约束冲突 | 占位值含 `oidc_<sub>`（sub 唯一），不会冲突 |
| Cookie 跨域问题 | OIDC 回调 Cookie 丢失 | OIDC 回调在同域 `pir.xiaoyyua.top`，Cookie 同域携带 |
| 现有固件迁移中断 | 部分固件在本地、部分在 Alist | 迁移脚本检查已存在则跳过；迁移期间保持双读 fallback（P2） |

---

*文档结束。如有疑问请联系架构师高见远（Gao）。*

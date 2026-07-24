# PRD — pir-cloud OIDC 一键登录 & Alist 固件分发

## 1. 项目信息

| 项 | 值 |
|---|---|
| **项目名称** | pir_cloud_oidc_alist |
| **语言** | 中文 |
| **后端** | Node.js + Fastify + Prisma + MySQL |
| **前端** | React + MUI + Tailwind CSS + Vite |
| **原始需求复述** | 为 pir-cloud 红外人体感应云端报警系统新增两大功能：(1) 对接 Xiaoyu 统一认证 OIDC Provider，在登录页新增"QQ 一键登录"入口，支持老用户 QQ 匹配直接登录、新用户自动注册并强制绑定邮箱；(2) 将固件存储从本地文件系统迁移至雨云对象存储（通过 Alist API 管理），实现上传/下载/删除全部走 Alist 对象存储。 |

---

## 2. 产品目标

| # | 目标 | 衡量标准 |
|---|------|---------|
| G1 | **降低用户登录门槛**：通过 OIDC 一键登录让已有 pir-cloud 账号的 QQ 用户无需记忆邮箱密码即可登录，同时让新用户通过 QQ 快速进入系统 | OIDC 登录功能上线后，首周内通过 OIDC 登录的用户占比 ≥ 20% |
| G2 | **提升固件分发可靠性**：将固件存储从单机本地磁盘迁移至雨云 S3 兼容对象存储，消除磁盘空间瓶颈和单点故障 | 上线后固件上传/下载成功率 ≥ 99.9%，现有固件无缝迁移、设备 OTA 不中断 |
| G3 | **保持系统安全与数据一致性**：OIDC 登录全程使用 PKCE + state 防 CSRF/授权码截持；新用户继承 OIDC QQ 号但仍需走 pir-cloud QQ 验证流程确认归属；Alist 迁移对现有数据库结构零侵入 | 无安全漏洞（PKCE/state 全覆盖），数据库 schema 无破坏性变更，QQ 验证状态 `qq_verified` 仅在 pir-cloud 自有验证流程通过后才置 true |

---

## 3. 用户故事

### 功能一：OIDC 一键登录

**US-1：老用户 QQ 一键登录**
> 作为一名已在 pir-cloud 注册并绑定过 QQ 号的用户，我想通过"QQ 一键登录"直接登录系统，这样我就不用每次都输入邮箱和密码。

**US-2：新用户通过 OIDC 注册**
> 作为一名没有 pir-cloud 账号但拥有 QQ 的用户，我想通过"QQ 一键登录"快速注册并进入系统，这样我就能省去填写注册表单和邮箱验证码的步骤，在后续需要时再绑定邮箱。

**US-3：新用户登录后绑定邮箱**
> 作为一名通过 OIDC 登录的新用户，我登录后被引导到"绑定邮箱"页面，我需要输入邮箱并完成验证码验证来绑定邮箱，绑定成功后才能使用设备管理、告警通知等全部功能。

**US-4：新用户验证 QQ 归属**
> 作为一名通过 OIDC 登录的新用户，我的 QQ 号已从 OIDC 预填，但需要通过 pir-cloud 的 QQ 验证流程（向机器人发码）确认我对该 QQ 号的实际控制权，验证通过后才能使用 QQ 通知渠道。

### 功能二：Alist 固件分发

**US-5：管理员上传固件到对象存储**
> 作为管理员，我在固件管理页面上传新固件版本时，系统自动将文件上传到雨云对象存储（通过 Alist API），上传成功后数据库记录文件元数据，不再占用本地磁盘空间。

**US-6：设备/用户下载固件**
> 作为设备或用户，我访问固件下载接口时，系统通过 Alist API 获取下载链接或代理下载文件，下载体验与之前一致（直接获得固件二进制流），无需感知后端存储变更。

---

## 4. 需求池

### P0 — Must Have（必须有）

#### OIDC 一键登录

| ID | 需求描述 |
|----|---------|
| OIDC-P0-1 | **新增 `server/src/modules/oidc/` 模块**，实现 OAuth2 Authorization Code + PKCE (S256) 流程：生成 code_verifier / code_challenge，构造授权 URL（含 `state` 防 CSRF），携带 `scope=openid profile qq` 重定向至 `https://auth.xiaoyyua.top/authorize` |
| OIDC-P0-2 | **新增回调端点 `GET /api/auth/oidc/callback`**：接收 `code` + `state`，校验 state 一致性，用 code + code_verifier 向 OIDC Token 端点交换 access_token，再请求 `/me` UserInfo 端点获取 `{ sub, nickname, qq }` |
| OIDC-P0-3 | **用户匹配逻辑**：用 OIDC 返回的 `qq` 字段查询 `users.qq_number`；命中 → 直接登录该用户（复用 `authService.generateTokens()` 签发 pir-cloud JWT 双 Token）；未命中 → 自动创建新用户 |
| OIDC-P0-4 | **新用户自动注册**：创建 User 记录，`email` 使用占位值（如 `oidc_<sub>@placeholder.pir-cloud.local`），`password` 随机生成（不可用于密码登录），`nickname` 取 OIDC `nickname` 或默认"用户"，`qq_number` 填入 OIDC 返回的 QQ 号，`qq_verified = false`，`membership_level = free` |
| OIDC-P0-5 | **新用户强制绑定邮箱状态**：在 User 表新增 `email_verified` 布尔字段（或复用占位邮箱判断逻辑）；未绑定真实邮箱的用户，前端 `AuthGuard` 重定向至 `/bind-email` 页面，仅允许访问绑定邮箱页面，其他路由全部拦截 |
| OIDC-P0-6 | **前端登录页新增"QQ 一键登录"入口**：在 `LoginPage.tsx` 邮箱密码表单下方添加分割线和 QQ 登录按钮，点击后调用 `GET /api/auth/oidc/login` 重定向至 OIDC 授权页 |
| OIDC-P0-7 | **前端 OIDC 回调处理页**：新增 `/auth/oidc/callback` 路由页面，解析 URL 中的 `code` 和 `state`，调用回调 API，成功后存 Token 并跳转 Dashboard（或 `/bind-email` 若需绑定邮箱），失败显示错误提示 |
| OIDC-P0-8 | **前端绑定邮箱页面 `/bind-email`**：邮箱输入 + 验证码发送 + 验证码验证，复用现有 `sendVerificationCode` / `verifyCode` 逻辑；绑定成功后更新用户 `email` 并移除占位标记，重定向至 Dashboard |
| OIDC-P0-9 | **配置项**：在 `config/index.ts` 新增 `oidc` 配置块（issuer, clientId, clientSecret, redirectUri, scopes），通过环境变量注入 |
| OIDC-P0-10 | **QQ 验证限制放开**：修改 `qq-verify.service.ts` 中 `requestCode()` 方法的 premium 校验逻辑。当前代码（第 36-46 行）检查 `membership_level === 'premium'` 并拒绝非 premium 用户。需要改为：OIDC 登录的新用户（通过 `oidc_sub IS NOT NULL` 或 `email_verified = false` 识别）可免费发起 QQ 验证，移除 premium 限制。实现方案：新增 `canVerifyQq(userId)` 内部方法判断用户是否有权验证 QQ（premium 会员 **或** OIDC 注册用户），`requestCode()` 调用此方法替代直接检查 membership |

#### Alist 固件分发

| ID | 需求描述 |
|----|---------|
| ALIST-P0-1 | **新增 `server/src/modules/alist/` 模块**：封装 Alist API 客户端（带 Token 鉴权），实现 `uploadFile(remotePath, buffer)` / `getDownloadUrl(remotePath)` / `deleteFile(remotePath)` / `fileExists(remotePath)` 方法 |
| ALIST-P0-2 | **改造 `AdminFirmwareService.uploadFirmware()`**：将 `fs.writeFileSync()` 替换为 `alistService.uploadFile()`，上传到不含中文字符的路径（推荐 `/S3-Rainyun-18376752486(11323)/alist1/guest/pir_download/<disk_filename>`）；`disk_filename` 字段复用为对象存储文件名。**注意：原路径含中文"其他"会导致 S3 返回 403 Forbidden，必须使用纯英文路径** |
| ALIST-P0-3 | **改造固件下载流程**（公开 + 管理员）：`downloadLatestHandler` / `downloadByVersionHandler` / `downloadFirmwareHandler` 中，将 `fs.readFileSync()` 替换为通过 Alist API 获取下载链接并 302 重定向（或代理流式下载） |
| ALIST-P0-4 | **改造 `AdminFirmwareService.deleteFirmware()`**：将 `fs.unlinkSync()` 替换为 `alistService.deleteFile()` |
| ALIST-P0-5 | **配置项**：在 `config/index.ts` 新增 `alist` 配置块（baseUrl, apiToken, firmwareBasePath），通过环境变量注入 |
| ALIST-P0-6 | **现有固件数据迁移**：编写一次性迁移脚本，将 `firmware_store/` 目录下已有固件文件上传至 Alist 对应路径，确保数据库中已有记录的 `disk_filename` 在对象存储中可访问 |

### P1 — Should Have（应该有）

| ID | 需求描述 |
|----|---------|
| OIDC-P1-1 | **OIDC Discovery 自动发现**：启动时请求 `https://auth.xiaoyyua.top/.well-known/openid-configuration` 自动获取 authorize/token/userinfo 端点地址，避免硬编码 |
| OIDC-P1-2 | **OIDC 登录关联记录**：新增 `user_oidc_links` 表或在 User 表新增 `oidc_sub` 字段，记录用户与 OIDC Provider 的关联关系，支持后续多 Provider 扩展 |
| OIDC-P1-3 | **绑定邮箱后清理占位数据**：用户绑定真实邮箱后，将占位 email 替换为真实 email 并设置 `email_verified = true`；同时可选择允许用户设置密码（当前 OIDC 新用户无密码） |
| OIDC-P1-4 | **登录页 OIDC 按钮 loading 状态**：点击 QQ 登录后显示 loading，防止重复点击；回调页显示"正在登录..."过渡动画 |
| ALIST-P1-1 | **Alist API 错误处理与重试**：上传/下载/删除失败时记录详细日志，上传支持自动重试（最多 3 次），删除失败记录告警但不阻断主流程 |
| ALIST-P1-2 | **固件下载方式选择**：支持配置切换"302 重定向直链"与"服务端代理流式下载"两种模式；默认 302 重定向（减少服务器带宽），代理模式作为 fallback |
| ALIST-P1-3 | **固件上传进度反馈**：管理员上传固件时前端显示上传进度条（通过 multipart 上传 + 后端 Alist 上传状态轮询或 SSE 推送） |

### P2 — Nice to Have（可以有）

| ID | 需求描述 |
|----|---------|
| OIDC-P2-1 | **个人中心绑定/解绑 OIDC**：已注册用户（邮箱密码登录）可在个人中心主动绑定 QQ 一键登录，绑定后也可解绑 |
| OIDC-P2-2 | **OIDC 登录失败友好提示**：OIDC Provider 不可达、用户拒绝授权、QQ 号为空等异常场景的前端友好提示 |
| ALIST-P2-1 | **本地存储 fallback**：Alist API 不可用时，临时回退到本地文件系统存储（降级模式），并在管理面板展示存储模式状态 |
| ALIST-P2-2 | **固件存储用量统计**：管理员面板展示对象存储中固件总大小、文件数量等统计信息 |

---

## 5. UI 设计要点

### 5.1 登录页改造（`LoginPage.tsx`）

```
┌─────────────────────────────────┐
│         pir-cloud               │
│   物联网人体感应云端告警面板      │
│                                 │
│  [ 登录 ] [ 注册 ]              │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 📧  邮箱                 │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 🔒  密码            👁   │   │
│  └─────────────────────────┘   │
│                                 │
│  [ Cloudflare Turnstile ]       │
│                                 │
│  ┌─────────────────────────┐   │
│  │        登录              │   │
│  └─────────────────────────┘   │
│                                 │
│  忘记密码？                     │
│                                 │
│  ─────── 或 ───────            │
│                                 │
│  ┌─────────────────────────┐   │
│  │  💬  QQ 一键登录         │   │  ← 新增，QQ 图标 + 蓝色按钮
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

- 分割线"或"使用 MUI `Divider` 组件，`textAlign="center"`
- QQ 登录按钮使用蓝色系（`#12B7F5` QQ 品牌色），`variant="outlined"` 或自定义颜色
- 点击后触发 `window.location.href = '/api/auth/oidc/login'`（后端 302 跳转至 OIDC Provider）

### 5.2 OIDC 回调页（新增 `/auth/oidc/callback`）

```
┌─────────────────────────────────┐
│                                 │
│        ⏳ 正在登录...           │
│                                 │
│    请稍候，正在处理登录信息      │
│                                 │
└─────────────────────────────────┘
```

- 全屏居中，CircularProgress + 文案
- 解析 URL query params（`code`, `state`），POST 到后端回调 API
- 成功 → `authStore.setAuth()` → 若 `email_verified === false` 则跳 `/bind-email`，否则跳 Dashboard
- 失败 → 显示 Alert 错误信息 + "返回登录"按钮

### 5.3 绑定邮箱页（新增 `/bind-email`）

```
┌─────────────────────────────────┐
│         pir-cloud               │
│                                 │
│   🔗 绑定邮箱                   │
│   请绑定您的邮箱以完成账号设置    │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 📧  邮箱地址             │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🔢  验证码        [发送]  │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │       绑定邮箱           │   │
│  └─────────────────────────┘   │
│                                 │
│  ⚠ 绑定邮箱后才能使用设备管理、  │
│    告警通知等功能               │
└─────────────────────────────────┘
```

- 布局与登录页风格一致（同 Card 样式）
- 邮箱输入框 + 验证码输入框 + "发送验证码"按钮（60s 倒计时）
- "发送验证码"调用 `/api/auth/send-code`（type 需新增 `bind_email` 类型，或复用 `register` 类型）
- 绑定成功后 toast 提示"邮箱绑定成功"并跳转 Dashboard
- 此页面不受 `AuthGuard` 拦截（已登录但未绑定邮箱的可访问），其他已登录路由在未绑定邮箱时重定向至此

### 5.4 AuthGuard 改造

```typescript
// AuthGuard.tsx 新增逻辑
if (isAuthenticated && !user.emailVerified) {
  // 允许访问 /bind-email，其他路由重定向到 /bind-email
  if (location.pathname !== '/bind-email') {
    return <Navigate to="/bind-email" replace />;
  }
}
```

### 5.5 固件管理页（`FirmwarePage.tsx`，管理员）

- 现有 UI 不变，上传/列表/删除/设为最新交互保持一致
- 上传成功后的 toast 提示可追加"已存储至对象存储"
- 无需向用户暴露存储后端细节

### 5.6 固件下载接口行为（对设备/用户透明）

- `GET /api/firmware/download/latest` 和 `GET /api/firmware/download/:version` 返回 302 重定向到 Alist 临时下载链接，或直接流式返回文件内容
- 设备端 OTA 刷写逻辑无需改动（HTTP GET 获取二进制即可）

---

## 6. 待确认问题

| # | 问题 | 影响范围 | 建议方案 |
|---|------|---------|---------|
| Q1 | **Alist 固件存储最终路径**：用户提供路径 `/S3-Rainyun-18376752486(11323)/alist1/guest/其他/pir_download` 含中文"其他"，在 S3 对象存储上返回 403 Forbidden。需确认改用哪种方案：(a) `/S3-Rainyun-18376752486(11323)/alist1/guest/pir_download`（去掉"其他"层）；(b) 在 Alist 根目录创建虚拟目录 `/pir-cloud-firmware/`；(c) 其他路径 | Alist 固件分发核心流程 | **必须确认**。建议方案 (a)，改动最小且规避中文路径问题。需主理人确认最终路径后再编码 |
| Q2 | **OIDC 客户端注册**：需要在 OIDC Provider（`https://auth.xiaoyyua.top`）的数据库中注册 pir-cloud 为新客户端，获取 `client_id` 和 `client_secret`。此操作需要在服务器上操作 SQLite 数据库 `oidc.db` 并 `systemctl restart oidc-koishi`。client_id/secret 是否已准备好？redirect_uri 确认为 `https://pir.xiaoyyua.top/auth/oidc/callback`？ | OIDC 登录核心流程 | 需主理人/运维确认 OIDC 客户端已注册并提供 client_id / client_secret / redirect_uri |
| Q3 | **占位邮箱唯一性**：OIDC 新用户使用 `oidc_<sub>@placeholder.pir-cloud.local` 作为占位邮箱，`email` 字段有 `@unique` 约束。需确认此方案可行，还是新增 `email_verified` 字段更合理？ | 数据库 schema | 建议新增 `email_verified Boolean @default(true)` 字段，OIDC 新用户 email 留空或占位，绑定后更新为真实邮箱并置 `email_verified = true`。需确认是否接受 schema 迁移 |
| Q4 | **OIDC 新用户是否需要设置密码**：OIDC 登录的新用户无密码，若用户后续想用邮箱+密码登录怎么办？是否在绑定邮箱时同时要求设置密码？ | 用户体验 | 建议在绑定邮箱页面可选设置密码（不强制），或后续在个人中心提供"设置密码"功能 |
| Q5 | **Alist 下载方式选择**：302 重定向到 Alist 直链 vs 服务端代理下载。302 方式会将 Alist 域名暴露给下载方（设备/用户），代理方式增加服务器带宽负担。倾向哪种？ | 固件下载性能/安全 | 建议默认 302 重定向（固件非敏感数据，直链更高效），配置项支持切换为代理模式 |
| Q6 | **OIDC 登录与邮箱密码登录的会话互斥**：同一用户先用邮箱密码登录，再用 OIDC 登录（或反之），是否互踢？当前 `refreshToken` 表未限制单设备登录。 | 多端登录体验 | 建议保持现有行为（允许多端登录，不互踢），除非有安全要求 |
| Q7 | **现有本地固件迁移**：`firmware_store/` 目录下已有固件文件需迁移到对象存储。迁移期间是否需要停机？还是双读模式（先查 Alist，未找到则 fallback 本地）？ | 迁移策略 | 建议编写迁移脚本一次性上传，迁移期间保持双读 fallback，确认全部迁移成功后移除本地文件 |
| Q8 | **OIDC `nickname` 为 null 的处理**：OIDC UserInfo 返回的 `nickname` 可能为 null，此时新用户昵称如何设置？ | 新用户注册 | 建议使用 `QQ用户_<qq号后4位>` 作为默认昵称 |
| Q9 | **绑定邮箱验证码类型**：现有 `VerificationCodeType` 枚举只有 `register` 和 `reset_password`，绑定邮箱需要新增 `bind_email` 类型吗？还是复用 `register`？ | 数据库 schema | 建议新增 `bind_email` 枚举值，语义更清晰 |

---

## 7. 技术规范补充

### 7.1 新增配置项（`server/src/config/index.ts`）

```typescript
oidc: {
  issuer: process.env.OIDC_ISSUER || 'https://auth.xiaoyyua.top',
  clientId: process.env.OIDC_CLIENT_ID || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  redirectUri: process.env.OIDC_REDIRECT_URI || 'https://pir.xiaoyyua.top/auth/oidc/callback',
  scopes: process.env.OIDC_SCOPES || 'openid profile qq',
},

alist: {
  baseUrl: process.env.ALIST_BASE_URL || 'https://alist.xiaoyyua.top',
  apiToken: process.env.ALIST_API_TOKEN || '',
  firmwareBasePath: process.env.ALIST_FIRMWARE_PATH || '/S3-Rainyun-18376752486(11323)/alist1/guest/pir_download',
  // 注意：原路径含中文"其他"会导致 S3 403 Forbidden，必须使用纯英文路径
},
```

### 7.2 数据库 Schema 变更（Prisma migration）

```prisma
// User 模型新增字段
model User {
  // ... 现有字段 ...
  email_verified   Boolean  @default(true)  // 新增：邮箱是否已验证（OIDC 新用户为 false）
  oidc_sub         String?  @db.VarChar(128) // 新增：OIDC Provider 返回的 sub 标识
  // ...
  @@index([oidc_sub])
}

// VerificationCodeType 枚举新增
enum VerificationCodeType {
  register
  reset_password
  bind_email        // 新增
}
```

### 7.3 新增 API 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/auth/oidc/login` | 无 | 生成 PKCE + state，302 重定向至 OIDC 授权页 |
| GET | `/api/auth/oidc/callback` | 无 | 接收 code+state，换取 token+userinfo，匹配/注册用户，返回 pir-cloud JWT |
| POST | `/api/auth/bind-email` | 需登录 | 绑定邮箱（邮箱+验证码），更新 `email` 和 `email_verified` |
| POST | `/api/auth/send-code` | 需登录（绑定邮箱场景） | 发送绑定邮箱验证码（type=bind_email） |

### 7.4 新增前端路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/auth/oidc/callback` | `OidcCallbackPage` | OIDC 回调处理页 |
| `/bind-email` | `BindEmailPage` | 绑定邮箱页（未绑定邮箱用户专属） |

---

## 8. 验收标准

### OIDC 一键登录

- [ ] 登录页展示"QQ 一键登录"按钮，点击后正确跳转至 OIDC 授权页
- [ ] OIDC 授权完成后回调到 pir-cloud，自动完成登录并跳转 Dashboard
- [ ] 已绑定 QQ 号的老用户通过 OIDC 登录后继承原账号所有数据和绑定关系
- [ ] 新用户通过 OIDC 登录后自动注册，跳转至绑定邮箱页面
- [ ] 未绑定邮箱的用户访问其他页面时被重定向至绑定邮箱页
- [ ] 绑定邮箱后可正常访问所有功能页面
- [ ] OIDC 新用户可免费发起 QQ 验证（不受 premium 限制）
- [ ] PKCE code_verifier / code_challenge (S256) 正确生成和验证
- [ ] state 参数正确生成、存储、校验，防止 CSRF

### Alist 固件分发

- [ ] 管理员上传固件后文件存储在 Alist 对象存储中，本地磁盘不产生新文件
- [ ] 设备/用户下载固件时正确获取文件内容（302 或代理）
- [ ] 管理员删除固件时对象存储中对应文件同步删除
- [ ] 现有固件数据迁移后可正常下载
- [ ] 固件 checksum 验证仍然有效
- [ ] Alist API 不可用时上传/下载有明确错误提示

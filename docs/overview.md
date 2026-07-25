# OIDC 一键登录 + Alist 固件分发 — 交付概览

> 交付日期：2026-07-24
> 项目：pir-cloud 红外人体感应云端报警管理系统

## TL;DR

为 pir-cloud 系统新增了 OIDC 一键登录（QQ 登录）和 Alist 对象存储固件分发两大功能，已部署到生产服务器并通过验证。

## 交付概览

| 项目 | 状态 |
|------|------|
| 代码实现 | ✅ 完成（36 个文件变更） |
| 后端编译 | ✅ TypeScript 编译通过 |
| 前端构建 | ✅ Vite 构建通过 |
| 安全审查 | ✅ PKCE/state/Cookie/SQL 注入/XSS 全部通过 |
| 生产部署 | ✅ systemd 服务 active running |
| 数据库迁移 | ✅ ALTER TABLE 已执行 |
| 固件迁移 | ✅ 已上传到 Alist 对象存储 |
| 端点验证 | ✅ OIDC 登录 + 固件下载 302 重定向正常 |
| GitHub 同步 | ⚠️ 已 commit（87dfed1），推送需手动完成（GitHub 被墙） |

## 功能说明

### 1. OIDC 一键登录
- 对接自建 Xiaoyu OIDC Provider (auth.xiaoyyua.top)
- PKCE S256 授权码流程 + state CSRF 防护
- Token 通过 URL fragment 传递（安全，不泄露到日志/Referer）
- 老用户：QQ 号匹配自动关联，继承原账号
- 新用户：自动注册，默认填入 QQ 号，强制绑定邮箱

### 2. Alist 对象存储固件分发
- 固件存储从本地文件系统迁移到雨云对象存储
- 上传：通过 Alist API (PUT /api/fs/put)
- 下载：302 重定向到 Alist 直链（减少服务器带宽）
- 删除：通过 Alist API (POST /api/fs/remove)

### 3. 邮箱绑定
- OIDC 新用户登录后强制绑定真实邮箱
- AuthGuard 拦截未绑定邮箱用户
- 邮箱验证码 type 新增 bind_email

### 4. QQ 验证限制放开
- OIDC 注册用户（oidc_sub 不为空）可免费验证 QQ
- 不再限制仅 premium 会员可验证

## 验证结果

### 功能性测试
- ✅ `GET /api/auth/oidc/login` → 302 重定向到 OIDC Provider（含 PKCE 参数）
- ✅ `GET /api/firmware/download/latest` → 302 重定向到 Alist 直链
- ✅ `GET /api/firmware/latest` → 返回固件元数据 JSON
- ✅ `GET /health` → `{"status":"ok"}`
- ✅ HTTPS 通过 Nginx 正常工作

### 安全性测试
- ✅ PKCE S256：32 字节随机 code_verifier，SHA256 code_challenge
- ✅ state CSRF 防护：16 字节随机 state，Cookie 存储并校验
- ✅ Cookie 安全：HttpOnly + Secure + SameSite=Lax + 10 分钟过期
- ✅ Token 传递：URL fragment，不出现在服务器日志/Referer
- ✅ SQL 注入防护：Prisma ORM 参数化查询
- ✅ 邮箱唯一性校验：绑定前检查
- ✅ OIDC 新用户随机密码：不可用于密码登录

### 稳定性
- ✅ systemd 服务 enabled（开机自启动）
- ✅ OneBot WebSocket 自动重连
- ✅ 定时任务正常（心跳检查、数据清理、在线提醒）
- ✅ Alist API 不可用时返回 404 而非崩溃

## 用户下一步建议

1. **GitHub 推送**：本地已 commit（87dfed1），由于 GitHub 被墙无法推送。建议：
   - 使用 VPN 推送：`cd D:\pir-old\pir-cloud-main && git push origin main`
   - 或添加服务器 SSH 公钥到 GitHub 后从服务器推送
2. **OIDC 端到端测试**：访问 https://pir.xiaoyyua.top/login 点击"QQ 一键登录"测试完整流程
3. **固件上传测试**：在管理后台上传新固件，验证 Alist 存储正常
4. **邮箱绑定测试**：用 OIDC 登录新用户，验证邮箱绑定流程
5. **监控**：`journalctl -u pir-cloud-old.service -f` 查看实时日志

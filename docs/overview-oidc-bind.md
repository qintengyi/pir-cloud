# 个人中心 OIDC 绑定/解绑功能 — 交付概览

## TL;DR
在 pir-cloud 个人中心新增"QQ 认证"卡片，已登录用户可绑定/解绑 OIDC（QQ 一键登录）认证。

## 交付概览
- **交付状态**：✅ 已部署上线
- **测试通过率**：100%（后端编译、前端构建、端点验证全部通过）
- **已知问题数**：0

## 功能说明
- **绑定流程**：个人中心 → 点击"绑定 QQ 认证" → 跳转 OIDC 授权 → 回调自动绑定 → 返回个人中心显示"已绑定"
- **解绑流程**：个人中心 → 点击"解绑 QQ 认证" → 安全检查通过 → 清空绑定
- **安全检查**：
  - placeholder 邮箱（`*@placeholder.pir-cloud.local`）不可解绑
  - 邮箱未验证不可解绑
  - OIDC 账号已被其他用户绑定时拒绝绑定
- **附带能力**：绑定时若用户无 QQ 号且 OIDC 提供了 QQ 号，自动填入（需另行验证）

## 修改文件清单（8 个）
| 文件 | 变更 |
|------|------|
| server/src/modules/oidc/oidc.controller.ts | 新增 oidcBindInitHandler + 修改 oidcCallbackHandler |
| server/src/modules/oidc/oidc.routes.ts | 新增 GET /api/auth/oidc/bind 路由 |
| server/src/modules/auth/auth.service.ts | 新增 bindOidc + unbindOidc 方法 |
| server/src/modules/auth/auth.controller.ts | 新增 unbindOidcHandler |
| server/src/modules/auth/auth.routes.ts | 新增 POST /api/auth/oidc/unbind 路由 |
| web/src/utils/constants.ts | 新增 OIDC_BIND_URL |
| web/src/api/auth.api.ts | 新增 unbindOidc 函数 |
| web/src/pages/profile/ProfilePage.tsx | 新增 QQ 认证卡片 + URL 参数处理 |

## 部署信息
- 服务器：192.168.1.8:22 (root)
- 部署路径：/www/wwwroot/pir.xiaoyyua.top/server_old
- systemd 服务：pir-cloud-old.service (active, enabled)
- 访问地址：https://pir.xiaoyyua.top/profile

## 用户下一步建议
1. 打开 https://pir.xiaoyyua.top/profile 查看新增的"QQ 认证"卡片
2. 点击"绑定 QQ 认证"测试完整绑定流程
3. 绑定后尝试用 QQ 一键登录验证关联是否正确
4. 测试解绑功能（确认安全检查生效）

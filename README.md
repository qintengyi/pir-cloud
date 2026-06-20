# pir-cloud

红外人体感应云端管理系统：服务端 + 前端。

## 目录结构
- `server/`：Node.js + Fastify + Prisma 后端
- `web/`：React + Vite + MUI 前端
- `docs/`：架构、PRD、固件集成等文档

## 后端启动
```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 前端启动
```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

所有敏感配置通过环境变量注入，参考 `server/.env.example` 和 `web/.env.example`。
切勿提交真实的 `.env` 文件。

# pir-cloud 后端部署文档

## 一、环境要求

- **Node.js**: >= 18.0.0
- **MySQL**: >= 8.0
- **Nginx**: >= 1.18
- **PM2**: 全局安装 (`npm install -g pm2`)

## 二、部署步骤

### 1. 克隆代码并安装依赖

```bash
cd /opt/pir-cloud/server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接、JWT 密钥等
vim .env
```

关键配置项：
- `DATABASE_URL`: MySQL 连接字符串
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: JWT 密钥（生产环境务必修改为强随机字符串）
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: 超级管理员账号密码

### 3. 初始化数据库

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE pir_cloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 生成 Prisma Client
npm run db:generate

# 执行数据库迁移
npm run db:migrate

# 初始化超级管理员
npm run seed
```

### 4. 编译 TypeScript

```bash
npm run build
```

### 5. 使用 PM2 启动

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # 设置开机自启
```

### 6. 配置 Nginx

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/pir-cloud
# 编辑 Nginx 配置，修改 server_name 和路径
vim /etc/nginx/sites-available/pir-cloud
ln -s /etc/nginx/sites-available/pir-cloud /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. 申请 SSL 证书（Let's Encrypt）

```bash
certbot --nginx -d your-domain.com
```

## 三、常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs pir-cloud-server

# 重启应用
pm2 restart pir-cloud-server

# 停止应用
pm2 stop pir-cloud-server

# 更新代码后重新部署
git pull && npm install && npm run build && pm2 restart pir-cloud-server
```

## 四、数据库维护

```bash
# 查看数据库结构
npm run db:studio

# 创建新迁移
npm run db:migrate -- --name your-migration-name

# 重置数据库（危险！仅开发环境）
npx prisma migrate reset
```

## 五、日志管理

PM2 日志输出到 `./logs/` 目录：
- `logs/out.log`: 标准输出日志
- `logs/error.log`: 错误日志

建议配置 logrotate 定期轮转：
```bash
pm2 install pm2-logrotate
```

## 六、备份策略

建议每日备份 MySQL 数据库：
```bash
# 添加到 crontab
0 3 * * * mysqldump -u root -pYOUR_PASSWORD pir_cloud | gzip > /backup/pir_cloud_$(date +\%Y\%m\%d).sql.gz
```

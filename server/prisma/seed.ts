import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/index';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

/**
 * 数据库种子脚本
 * 初始化超级管理员账号
 */
async function main(): Promise<void> {
  const adminEmail = config.seedAdmin.email;
  const adminPassword = config.seedAdmin.password;

  logger.info(`Seeding super admin: ${adminEmail}`);

  // 检查是否已存在
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    logger.info('Super admin already exists, skipping seed.');
    return;
  }

  // 创建超级管理员
  const hashedPassword = await bcrypt.hash(adminPassword, config.bcryptSaltRounds);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      nickname: '超级管理员',
      role: 'admin',
      membership_level: 'premium',
    },
  });

  logger.info(`Super admin created successfully: id=${admin.id}, email=${admin.email}`);

  // 初始化默认系统配置
  const defaultConfigs = [
    { config_key: 'smtp', config_value: { host: '', port: 465, username: '', password: '', from: '', secure: true } as any },
    { config_key: 'onebot', config_value: { wsUrl: config.onebot.wsUrl, token: config.onebot.token } as any },
  ];

  for (const cfg of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { config_key: cfg.config_key },
      update: {},
      create: cfg,
    });
  }

  logger.info('Default system configs initialized.');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seed script failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

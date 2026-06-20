import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * 鐜鍙橀噺閰嶇疆瀵硅薄
 * 鎵€鏈夐厤缃」闆嗕腑绠＄悊锛屾彁渚涚被鍨嬪畨鍏ㄥ拰榛樿鍊?
 */
export const config = {

  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '10310', 10),
  isProduction: process.env.NODE_ENV === 'production',

  databaseUrl: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/pir_cloud',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev-only',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev-only',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
    secretKey: process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA',
    secretKeyRegister: process.env.TURNSTILE_SECRET_KEY_REGISTER || '1x0000000000000000000000000000000AA',
    verifyUrl: process.env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  },

  deviceTokenLength: parseInt(process.env.DEVICE_TOKEN_LENGTH || '32', 10),
  heartbeatTimeoutSeconds: parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '300', 10),

  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '90', 10),

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@pir-cloud.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  },

  onebot: {
    wsUrl: process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:8080',
    token: process.env.ONEBOT_TOKEN || '',
  },

  epay: {
    apiUrl: process.env.EPAY_API_URL || 'https://your-epay.example.com',
    pid: parseInt(process.env.EPAY_PID || '1', 10),
    key: process.env.EPAY_KEY || '',
    membershipPrice: parseFloat(process.env.MEMBERSHIP_PRICE || '1'),
  },

  rateLimit: {
    auth: parseInt(process.env.RATE_LIMIT_AUTH || '5', 10),
    report: parseInt(process.env.RATE_LIMIT_REPORT || '60', 10),
  },
} as const;

export type Config = typeof config;

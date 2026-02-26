import 'dotenv/config';

function buildDatabaseUrl(): string {
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? '';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME ?? 'auth_service';

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

interface AppConfigShape {
  server: { port: number; nodeEnv: string };
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    ssl: boolean;
    url: string;
  };
  bcrypt: { saltRounds: number };
  oauth: { google: { clientId: string; clientSecret: string; redirectUri: string } };
  session: {
    cookieName: string;
    maxAgeDays: number;
    cacheTtlSeconds: number;
    cleanupIntervalMs: number;
    revokedRetentionDays: number;
  };
  cookies: { secure: boolean; sameSite: 'lax' | 'strict' | 'none'; domain: string | undefined; httpOnly: boolean };
  cors: { origin: string };
  redis: { url: string; tls: boolean };
  frontend: { url: string };
  aws: { accessKeyId: string; secretAccessKey: string; region: string };
  ses: { fromEmail: string; fromName: string };
  passwordReset: { tokenTtlMinutes: number; cooldownSeconds: number; maxRequestsPerWindow: number; maxAttempts: number };
}

/**
 * NestJS Configuration
 * Preserves exact structure from src/config/index.ts
 */
export const configuration = (): AppConfigShape => ({
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'auth_service',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT ?? '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT ?? '2000', 10),
    ssl: process.env.DB_SSL === 'true',
    url: process.env.DATABASE_URL ?? buildDatabaseUrl(),
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth',
    },
  },
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME ?? 'session_id',
    maxAgeDays: parseInt(process.env.SESSION_MAX_AGE_DAYS ?? '30', 10),
    cacheTtlSeconds: parseInt(process.env.SESSION_CACHE_TTL_SECONDS ?? '300', 10),
    cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS ?? '3600000', 10),
    revokedRetentionDays: parseInt(process.env.SESSION_REVOKED_RETENTION_DAYS ?? '7', 10),
  },
  cookies: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    domain: process.env.COOKIE_DOMAIN,
    httpOnly: true,
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    tls: process.env.REDIS_TLS === 'true',
  },
  frontend: {
    url: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? 'us-east-2',
  },
  ses: {
    fromEmail: process.env.SES_FROM_EMAIL ?? 'notifications@traderlion.com',
    fromName: process.env.SES_FROM_NAME ?? 'TraderLion',
  },
  passwordReset: {
    tokenTtlMinutes: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? '60', 10),
    cooldownSeconds: 60,
    maxRequestsPerWindow: 3,
    maxAttempts: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? '5', 10),
  },
});

export type AppConfig = ReturnType<typeof configuration>;

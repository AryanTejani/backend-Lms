import { sharedConfiguration, SharedConfigShape } from '@app/shared/config/shared-configuration';

interface AdminPanelConfigShape extends SharedConfigShape {
  server: { port: number; nodeEnv: string };
  session: {
    cookieName: string;
    maxAgeDays: number;
    cacheTtlSeconds: number;
  };
  cookies: { secure: boolean; sameSite: 'lax' | 'strict' | 'none'; domain: string | undefined; httpOnly: boolean };
  cors: { origin: string };
}

export const configuration = (): AdminPanelConfigShape => ({
  ...sharedConfiguration(),
  server: {
    port: parseInt(process.env.ADMIN_PORT ?? '5007', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  session: {
    cookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? 'admin_session_id',
    maxAgeDays: parseInt(process.env.ADMIN_SESSION_MAX_AGE_DAYS ?? '7', 10),
    cacheTtlSeconds: parseInt(process.env.ADMIN_SESSION_CACHE_TTL_SECONDS ?? '60', 10),
  },
  cookies: {
    secure: process.env.NODE_ENV !== 'development',
    sameSite: (process.env.ADMIN_COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    domain: process.env.ADMIN_COOKIE_DOMAIN,
    httpOnly: true,
  },
  cors: {
    origin: process.env.ADMIN_CORS_ORIGIN ?? 'http://localhost:3000',
  },
});

export type AdminPanelConfig = ReturnType<typeof configuration>;

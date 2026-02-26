import { sharedConfiguration, SharedConfigShape } from '@app/shared/config/shared-configuration';

interface MainPanelConfigShape extends SharedConfigShape {
  server: { port: number; nodeEnv: string };
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
  frontend: { url: string };
  gemini: { apiKey: string };
}

export const configuration = (): MainPanelConfigShape => ({
  ...sharedConfiguration(),
  server: {
    port: parseInt(process.env.PORT ?? '5000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:5000/api/auth',
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
    secure: process.env.NODE_ENV !== 'development',
    sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    domain: process.env.COOKIE_DOMAIN,
    httpOnly: true,
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3001',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
  },
});

export type MainPanelConfig = ReturnType<typeof configuration>;

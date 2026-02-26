import { sharedConfiguration, SharedConfigShape } from '@app/shared/config/shared-configuration';

interface MobileApiConfigShape extends SharedConfigShape {
  server: { port: number; nodeEnv: string };
  jwt: { secret: string; accessTokenTtl: string; refreshTokenTtl: string };
  cors: { origin: string };
  oauth: { google: { clientId: string; clientSecret: string; redirectUri: string } };
}

export const configuration = (): MobileApiConfigShape => ({
  ...sharedConfiguration(),
  server: {
    port: parseInt(process.env.MOBILE_PORT ?? '5002', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  jwt: {
    secret: ((): string => {
      const secret = process.env.MOBILE_JWT_SECRET;

      if (!secret) {
        throw new Error('MOBILE_JWT_SECRET environment variable is required');
      }

      return secret;
    })(),
    accessTokenTtl: process.env.MOBILE_JWT_ACCESS_TTL ?? '15m',
    refreshTokenTtl: process.env.MOBILE_JWT_REFRESH_TTL ?? '30d',
  },
  cors: {
    origin: ((): string => {
      const origin = process.env.MOBILE_CORS_ORIGIN;

      if (!origin) {
        throw new Error('MOBILE_CORS_ORIGIN environment variable is required');
      }

      return origin;
    })(),
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.MOBILE_GOOGLE_REDIRECT_URI ?? '',
    },
  },
});

export type MobileApiConfig = ReturnType<typeof configuration>;

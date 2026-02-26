import 'dotenv/config';

function buildDatabaseUrl(): string {
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? '';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME ?? 'auth_service';

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

export interface SharedConfigShape {
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
  redis: { url: string; tls: boolean };
  aws: { accessKeyId: string; secretAccessKey: string; region: string };
  ses: { fromEmail: string; fromName: string };
  passwordReset: { tokenTtlMinutes: number; cooldownSeconds: number; maxRequestsPerWindow: number; maxAttempts: number };
  bunny: {
    storagePublicApiKey: string;
    storagePublicZone: string;
    storagePublicEndpoint: string;
    storagePublicCdnBaseUrl: string;
    storagePrivateApiKey: string;
    storagePrivateZone: string;
    storagePrivateEndpoint: string;
    storagePrivateCdnBaseUrl: string;
    streamPublicApiKey: string;
    streamPublicLibraryId: string;
    streamPublicCdnHostname: string;
    streamPrivateApiKey: string;
    streamPrivateLibraryId: string;
    streamPrivateCdnHostname: string;
    streamPrivateTokenAuthKey: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    publishableKey: string;
  };
  logging: {
    dir: string;
  };
}

export const sharedConfiguration = (): SharedConfigShape => ({
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
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    tls: process.env.REDIS_TLS === 'true',
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
  bunny: {
    storagePublicApiKey: process.env.BUNNY_STORAGE_PUBLIC_API_KEY ?? process.env.BUNNY_STORAGE_API_KEY ?? '',
    storagePublicZone: process.env.BUNNY_STORAGE_PUBLIC_ZONE ?? process.env.BUNNY_STORAGE_ZONE ?? 'traderlion-media',
    storagePublicEndpoint: process.env.BUNNY_STORAGE_PUBLIC_ENDPOINT ?? process.env.BUNNY_STORAGE_ENDPOINT ?? 'https://ny.storage.bunnycdn.com',
    storagePublicCdnBaseUrl: process.env.BUNNY_STORAGE_PUBLIC_CDN_BASE_URL ?? process.env.BUNNY_CDN_BASE_URL ?? 'https://vz-a9f12ba5-5bf.b-cdn.net',
    storagePrivateApiKey: process.env.BUNNY_STORAGE_PRIVATE_API_KEY ?? '',
    storagePrivateZone: process.env.BUNNY_STORAGE_PRIVATE_ZONE ?? '',
    storagePrivateEndpoint: process.env.BUNNY_STORAGE_PRIVATE_ENDPOINT ?? 'https://ny.storage.bunnycdn.com',
    storagePrivateCdnBaseUrl: process.env.BUNNY_STORAGE_PRIVATE_CDN_BASE_URL ?? '',
    streamPublicApiKey: process.env.BUNNY_STREAM_PUBLIC_API_KEY ?? process.env.BUNNY_STREAM_API_KEY ?? '',
    streamPublicLibraryId: process.env.BUNNY_STREAM_PUBLIC_LIBRARY_ID ?? process.env.BUNNY_STREAM_LIBRARY_ID ?? '',
    streamPublicCdnHostname: process.env.BUNNY_STREAM_PUBLIC_CDN_HOSTNAME ?? process.env.BUNNY_STREAM_CDN_HOSTNAME ?? '',
    streamPrivateApiKey: process.env.BUNNY_STREAM_PRIVATE_API_KEY ?? '',
    streamPrivateLibraryId: process.env.BUNNY_STREAM_PRIVATE_LIBRARY_ID ?? '',
    streamPrivateCdnHostname: process.env.BUNNY_STREAM_PRIVATE_CDN_HOSTNAME ?? '',
    streamPrivateTokenAuthKey: process.env.BUNNY_STREAM_PRIVATE_TOKEN_AUTH_KEY ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  },
  logging: {
    dir: process.env.LOG_DIR ?? '/var/www/app/tmp/traderlionApp',
  },
});

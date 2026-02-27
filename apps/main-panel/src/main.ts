import 'reflect-metadata';
import { IncomingMessage } from 'http';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express, { json, urlencoded } from 'express';
import { join } from 'node:path';
import { MainPanelAppModule } from './app.module';
import { AuthExceptionFilter } from '@app/shared/filters/auth-exception.filter';
import { LoggerService } from '@app/shared/logger/logger.service';

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting main-panel application...');

    const isProduction = process.env.NODE_ENV === 'production';

    const app = await NestFactory.create(MainPanelAppModule, {
      bodyParser: false,
      logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = app.get(LoggerService);

    app.useLogger(logger);

    const configService = app.get(ConfigService);

    // Body parser with raw body capture for Stripe webhook signature verification
    app.use(
      json({
        limit: '10mb',
        verify: (req: IncomingMessage & { rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    app.use(urlencoded({ extended: true, limit: '10mb' }));

    // Security headers
    app.use(helmet());

    // Cookie parser middleware
    app.use(cookieParser());

    // Serve locally-stored uploads (fallback when Bunny CDN is not configured)
    const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsDir));

    // CORS configuration
    const corsOrigin = configService.get<string>('cors.origin');

    if (!corsOrigin) {
      throw new Error('CORS origin is not configured. Set CORS_ORIGIN environment variable.');
    }

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });

    // Global exception filter
    app.useGlobalFilters(new AuthExceptionFilter(logger));

    const port = configService.get<number>('server.port') ?? 5000;

    await app.listen(port);

    logger.log(`main-panel server running on port ${port}`, 'Bootstrap');
  } catch (error) {
    console.error('Failed to start main-panel application:', error);
    process.exit(1);
  }
}

bootstrap();

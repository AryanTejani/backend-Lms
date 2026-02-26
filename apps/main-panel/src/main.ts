import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { MainPanelAppModule } from './app.module';
import { AuthExceptionFilter } from '@app/shared/filters/auth-exception.filter';
import { LoggerService } from '@app/shared/logger/logger.service';

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting main-panel application...');

    const isProduction = process.env.NODE_ENV === 'production';

    const app = await NestFactory.create(MainPanelAppModule, {
      rawBody: true,
      logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = app.get(LoggerService);

    app.useLogger(logger);

    const configService = app.get(ConfigService);

    // Security headers
    app.use(helmet());

    // Cookie parser middleware
    app.use(cookieParser());

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

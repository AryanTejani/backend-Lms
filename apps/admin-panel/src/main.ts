import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AdminPanelAppModule } from './app.module';
import { AuthExceptionFilter } from '@app/shared/filters/auth-exception.filter';
import { LoggerService } from '@app/shared/logger/logger.service';

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting admin-panel application...');

    const isProduction = process.env.NODE_ENV === 'production';

    const app = await NestFactory.create(AdminPanelAppModule, {
      logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = app.get(LoggerService);

    app.useLogger(logger);

    const configService = app.get(ConfigService);

    // Security headers
    app.use(helmet());

    // Cookie parser for session cookies
    app.use(cookieParser());

    // CORS configuration
    const corsOrigin = configService.get<string>('cors.origin');

    if (!corsOrigin) {
      throw new Error('CORS origin is not configured. Set ADMIN_CORS_ORIGIN environment variable.');
    }

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });

    // Global exception filter
    app.useGlobalFilters(new AuthExceptionFilter(logger));

    const port = configService.get<number>('server.port') ?? 5003;

    await app.listen(port);

    logger.log(`admin-panel server running on port ${port}`, 'Bootstrap');
  } catch (error) {
    console.error('Failed to start admin-panel application:', error);
    process.exit(1);
  }
}

bootstrap();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { MobileApiAppModule } from './app.module';
import { AuthExceptionFilter } from '@app/shared/filters/auth-exception.filter';
import { LoggerService } from '@app/shared/logger/logger.service';

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting mobile-api application...');

    const isProduction = process.env.NODE_ENV === 'production';

    const app = await NestFactory.create(MobileApiAppModule, {
      logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const logger = app.get(LoggerService);

    app.useLogger(logger);

    const configService = app.get(ConfigService);

    // Security headers
    app.use(helmet());

    // CORS configuration
    const corsOrigin = configService.get<string>('cors.origin');

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });

    // Global prefix for mobile API
    app.setGlobalPrefix('api/v1');

    // Global exception filter
    app.useGlobalFilters(new AuthExceptionFilter(logger));

    const port = configService.get<number>('server.port') ?? 5002;

    await app.listen(port);

    logger.log(`mobile-api server running on port ${port}`, 'Bootstrap');
  } catch (error) {
    console.error('Failed to start mobile-api application:', error);
    process.exit(1);
  }
}

bootstrap();

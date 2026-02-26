import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AuthExceptionFilter } from './shared/filters/auth-exception.filter';

async function bootstrap(): Promise<void> {
  try {
    console.log('Starting NestJS application...');

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);

    // Cookie parser middleware
    app.use(cookieParser());

    // CORS configuration
    const corsOrigin = configService.get<string>('cors.origin');

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });

    // Global exception filter
    app.useGlobalFilters(new AuthExceptionFilter());

    const port = configService.get<number>('server.port') ?? 3000;

    await app.listen(port, '0.0.0.0');

    console.log(`NestJS server running on port ${port}`);
  } catch (error) {
    console.error('Failed to start NestJS application:', error);
    process.exit(1);
  }
}

bootstrap();

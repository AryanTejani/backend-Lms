import { Global, Module, DynamicModule } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({})
export class LoggerModule {
  static forRoot(appName: string): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      providers: [
        {
          provide: LoggerService,
          useFactory: (): LoggerService => new LoggerService(appName),
        },
      ],
      exports: [LoggerService],
    };
  }
}

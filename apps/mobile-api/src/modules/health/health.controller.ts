import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '@app/shared/database/database.service';
import { CacheService } from '@app/shared/cache/cache.service';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  app: string;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    const [dbHealthy, redisHealthy] = await Promise.all([this.databaseService.healthCheck(), this.cacheService.healthCheck()]);

    const allHealthy = dbHealthy && redisHealthy;

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      app: 'mobile-api',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    };
  }

  @Get('ready')
  async ready(): Promise<{ ready: boolean }> {
    const [dbHealthy, redisHealthy] = await Promise.all([this.databaseService.healthCheck(), this.cacheService.healthCheck()]);

    return { ready: dbHealthy && redisHealthy };
  }

  @Get('live')
  live(): { alive: boolean } {
    return { alive: true };
  }
}

import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/shared/prisma/prisma.module';
import { CacheModule } from '@app/shared/cache/cache.module';
import { EmailModule } from '@app/shared/email/email.module';
import { AuthDomainModule } from '@app/auth';
import { CustomerManagementRepository } from './repositories/customer-management.repository';
import { CustomerManagementService } from './services/customer-management.service';

@Module({
  imports: [PrismaModule, CacheModule, EmailModule, AuthDomainModule],
  providers: [CustomerManagementRepository, CustomerManagementService],
  exports: [CustomerManagementRepository, CustomerManagementService],
})
export class CustomerModule {}

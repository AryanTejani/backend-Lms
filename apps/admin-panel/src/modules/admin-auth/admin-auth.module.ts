import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { AdminAuthController } from './controllers/admin-auth.controller';

@Module({
  imports: [AuthDomainModule],
  controllers: [AdminAuthController],
})
export class AdminAuthModule {}

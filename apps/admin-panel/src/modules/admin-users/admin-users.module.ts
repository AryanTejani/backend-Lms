import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { AdminUserController } from './controllers/admin-user.controller';

@Module({
  imports: [AuthDomainModule],
  controllers: [AdminUserController],
})
export class AdminUsersModule {}

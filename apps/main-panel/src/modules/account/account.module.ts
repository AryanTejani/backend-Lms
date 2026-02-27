import { Module } from '@nestjs/common';
import { BillingModule } from '@app/billing';
import { AuthHttpModule } from '../auth/auth.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [BillingModule, AuthHttpModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

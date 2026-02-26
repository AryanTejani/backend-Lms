import { Module } from '@nestjs/common';
import { BillingModule } from '@app/billing';
import { MobileAuthHttpModule } from '../auth/mobile-auth.module';
import { MobileBillingController } from './mobile-billing.controller';

@Module({
    imports: [BillingModule, MobileAuthHttpModule],
    controllers: [MobileBillingController],
})
export class MobileBillingHttpModule { }

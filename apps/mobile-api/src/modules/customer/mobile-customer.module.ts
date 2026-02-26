import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { MobileCustomerController } from './mobile-customer.controller';

@Module({
    imports: [AuthDomainModule],
    controllers: [MobileCustomerController],
})
export class MobileCustomerHttpModule { }

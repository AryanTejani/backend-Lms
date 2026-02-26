import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { MobileAuthController } from './mobile-auth.controller';
import { SessionGuard, OptionalSessionGuard } from '../../guards/session.guard';

@Module({
    imports: [AuthDomainModule],
    controllers: [MobileAuthController],
    providers: [SessionGuard, OptionalSessionGuard],
    exports: [SessionGuard, OptionalSessionGuard, AuthDomainModule],
})
export class MobileAuthHttpModule { }

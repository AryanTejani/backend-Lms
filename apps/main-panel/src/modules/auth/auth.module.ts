import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { AuthController } from './controllers/auth.controller';
import { SessionGuard, OptionalSessionGuard } from '../../guards/session.guard';
import { ThrottleGuard } from '@app/shared/guards/throttle.guard';

/**
 * Auth HTTP Module (main-panel)
 * Thin HTTP layer - controllers only, business logic comes from @app/auth
 */
@Module({
  imports: [AuthDomainModule],
  controllers: [AuthController],
  providers: [SessionGuard, OptionalSessionGuard, ThrottleGuard],
  exports: [SessionGuard, OptionalSessionGuard, AuthDomainModule],
})
export class AuthHttpModule {}

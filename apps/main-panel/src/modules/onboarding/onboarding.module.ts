import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { OnboardingController } from './controllers/onboarding.controller';
import { SessionGuard } from '../../guards/session.guard';

@Module({
  imports: [AuthDomainModule],
  controllers: [OnboardingController],
  providers: [SessionGuard],
})
export class OnboardingModule {}

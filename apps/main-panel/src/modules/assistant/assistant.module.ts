import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantService } from './services/assistant.service';
import { SessionGuard } from '../../guards/session.guard';

@Module({
  imports: [AuthDomainModule],
  controllers: [AssistantController],
  providers: [AssistantService, SessionGuard],
})
export class AssistantModule {}

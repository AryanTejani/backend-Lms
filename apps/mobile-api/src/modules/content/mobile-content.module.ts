import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { MobileContentController } from './mobile-content.controller';
import { MobileAuthHttpModule } from '../auth/mobile-auth.module';

@Module({
    imports: [ContentModule, MobileAuthHttpModule],
    controllers: [MobileContentController],
})
export class MobileContentHttpModule { }

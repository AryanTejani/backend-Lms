import { Controller, Post, Get, Body, Res, UseGuards, UsePipes, Logger } from '@nestjs/common';
import { Response } from 'express';
import { CustomerAuthService } from '@app/auth/services/customer-auth.service';
import { SessionGuard } from '../../guards/session.guard';
import { Public } from '@app/shared/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser, SessionId } from '../../decorators/current-user.decorator';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { loginSchema, signupSchema, LoginInput, SignupInput } from './mobile-auth.schema';

@Controller('auth')
export class MobileAuthController {
    private readonly logger = new Logger(MobileAuthController.name);

    constructor(
        private readonly customerAuthService: CustomerAuthService,
    ) { }

    @Post('signup')
    @Public()
    @UsePipes(new ZodValidationPipe(signupSchema))
    async signup(@Body() body: SignupInput): Promise<{ user: AuthenticatedUser; sessionId: string }> {
        const { user, session } = await this.customerAuthService.signup(body);
        return { user, sessionId: session.id };
    }

    @Post('login')
    @Public()
    @UsePipes(new ZodValidationPipe(loginSchema))
    async login(@Body() body: LoginInput): Promise<{ user: AuthenticatedUser; sessionId: string }> {
        const { user, session } = await this.customerAuthService.login(body);
        return { user, sessionId: session.id };
    }

    @Post('logout')
    @UseGuards(SessionGuard)
    async logout(@SessionId() sessionId: string): Promise<{ success: boolean }> {
        await this.customerAuthService.logout(sessionId);
        return { success: true };
    }

    @Get('me')
    @UseGuards(SessionGuard)
    getMe(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
        return { user };
    }
}

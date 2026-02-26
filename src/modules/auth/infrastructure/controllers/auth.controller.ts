import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmailAuthService } from '../../application/services/email-auth.service';
import { OAuthService } from '../../application/services/oauth.service';
import { PasswordResetService } from '../../application/services/password-reset.service';
import { SessionGuard } from '@/shared/guards/session.guard';
import { ThrottleGuard, Throttle, ThrottlePresets } from '@/shared/guards/throttle.guard';
import { Public } from '@/shared/decorators/public.decorator';
import { CurrentUser, SessionId, AuthenticatedUser } from '@/shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  SignupInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordWithTokenInput,
} from '../schemas/auth.schema';

/**
 * Auth Controller
 * Unified controller for all /auth/* endpoints
 * Preserves all routes from Express implementation
 */
@Controller('auth')
@UseGuards(ThrottleGuard)
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailAuthService: EmailAuthService,
    private readonly oauthService: OAuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  /**
   * POST /auth/signup
   * Register a new user with email/password
   */
  @Post('signup')
  @Public()
  @Throttle(ThrottlePresets.signup)
  @UsePipes(new ZodValidationPipe(signupSchema))
  async signup(
    @Body() body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const { user, session } = await this.emailAuthService.signup(body);

    this.setSessionCookie(res, session.id);

    return { user };
  }

  /**
   * POST /auth/login
   * Login with email/password
   */
  @Post('login')
  @Public()
  @Throttle(ThrottlePresets.login)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const { user, session } = await this.emailAuthService.login(body);

    this.setSessionCookie(res, session.id);

    return { user };
  }

  /**
   * POST /auth/logout
   * Logout current session
   */
  @Post('logout')
  @UseGuards(SessionGuard)
  async logout(
    @SessionId() sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    await this.emailAuthService.logout(sessionId);

    this.clearSessionCookie(res);

    return { success: true };
  }

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  @Get('me')
  @UseGuards(SessionGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  /**
   * GET /auth/google
   * Initiate Google OAuth flow
   */
  @Get('google')
  @Public()
  async googleAuth(): Promise<{ url: string; state: string }> {
    return this.oauthService.getGoogleAuthUrl();
  }

  /**
   * GET /auth/google/callback
   * Handle Google OAuth callback
   * Redirects to frontend with success/error status
   */
  @Get('google/callback')
  @Public()
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('frontend.url') ?? 'http://localhost:3000';

    try {
      const { session, isNewUser } = await this.oauthService.handleGoogleCallback({
        code,
        state,
      });

      this.setSessionCookie(res, session.id);

      const redirectUrl = `${frontendUrl}/callback?success=true&isNewUser=${isNewUser}`;

      res.redirect(302, redirectUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      const errorUrl = `${frontendUrl}/callback?success=false&error=${encodeURIComponent(errorMessage)}`;

      res.redirect(302, errorUrl);
    }
  }

  /**
   * POST /auth/forgot-password
   * Request password reset email
   */
  @Post('forgot-password')
  @Public()
  @Throttle(ThrottlePresets.forgotPassword)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(
    @Body() body: ForgotPasswordInput,
  ): Promise<{ success: boolean; cooldownRemaining?: number }> {
    return this.passwordResetService.requestPasswordReset(body.email);
  }

  /**
   * POST /auth/forgot-password/reset
   * Reset password with token
   */
  @Post('forgot-password/reset')
  @Public()
  @Throttle(ThrottlePresets.resetPassword)
  @UsePipes(new ZodValidationPipe(resetPasswordWithTokenSchema))
  async resetPassword(
    @Body() body: ResetPasswordWithTokenInput,
  ): Promise<{ success: boolean }> {
    await this.passwordResetService.resetPasswordWithToken(body.token, body.password);

    return { success: true };
  }

  // ==================== COOKIE HELPERS ====================

  private setSessionCookie(res: Response, sessionId: string): void {
    const maxAgeDays = this.configService.get<number>('session.maxAgeDays') ?? 30;
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    const cookieName = this.configService.get<string>('session.cookieName') ?? 'session_id';
    const httpOnly = this.configService.get<boolean>('cookies.httpOnly') ?? true;
    const secure = this.configService.get<boolean>('cookies.secure') ?? false;
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('cookies.sameSite') ?? 'lax';
    const domain = this.configService.get<string>('cookies.domain');

    res.cookie(cookieName, sessionId, {
      httpOnly,
      secure,
      sameSite,
      domain,
      maxAge,
      path: '/',
    });
  }

  private clearSessionCookie(res: Response): void {
    const cookieName = this.configService.get<string>('session.cookieName') ?? 'session_id';
    const httpOnly = this.configService.get<boolean>('cookies.httpOnly') ?? true;
    const secure = this.configService.get<boolean>('cookies.secure') ?? false;
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('cookies.sameSite') ?? 'lax';
    const domain = this.configService.get<string>('cookies.domain');

    res.clearCookie(cookieName, {
      httpOnly,
      secure,
      sameSite,
      domain,
      path: '/',
    });
  }
}

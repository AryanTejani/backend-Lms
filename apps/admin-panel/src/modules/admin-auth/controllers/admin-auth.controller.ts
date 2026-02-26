import { Controller, Post, Get, Body, Res, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AdminAuthService } from '@app/auth/services/admin-auth.service';
import { ThrottleGuard, Throttle, ThrottlePresets } from '@app/shared/guards/throttle.guard';
import { Public } from '@app/shared/decorators/public.decorator';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AdminSessionId, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { adminLoginSchema, AdminLoginInput } from '../schemas/admin-auth.schema';

/**
 * Admin Auth Controller
 * Session-based auth endpoints for the admin panel
 */
@Controller('auth')
@UseGuards(ThrottleGuard)
export class AdminAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  /**
   * POST /auth/login
   */
  @Post('login')
  @Public()
  @Throttle(ThrottlePresets.login)
  @UsePipes(new ZodValidationPipe(adminLoginSchema))
  async login(@Body() body: AdminLoginInput, @Res({ passthrough: true }) res: Response): Promise<{ user: AuthenticatedAdmin }> {
    const { user, session } = await this.adminAuthService.login(body);

    this.setSessionCookie(res, session.id);

    return { user };
  }

  /**
   * POST /auth/logout
   */
  @Post('logout')
  async logout(@AdminSessionId() sessionId: string, @Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
    await this.adminAuthService.logout(sessionId);

    this.clearSessionCookie(res);

    return { success: true };
  }

  /**
   * GET /auth/me
   */
  @Get('me')
  getMe(@CurrentAdmin() user: AuthenticatedAdmin): { user: AuthenticatedAdmin } {
    return { user };
  }

  // ==================== COOKIE HELPERS ====================

  private setSessionCookie(res: Response, sessionId: string): void {
    const maxAgeDays = this.configService.get<number>('session.maxAgeDays') ?? 7;
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    const cookieName = this.configService.get<string>('session.cookieName') ?? 'admin_session_id';
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
    const cookieName = this.configService.get<string>('session.cookieName') ?? 'admin_session_id';
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

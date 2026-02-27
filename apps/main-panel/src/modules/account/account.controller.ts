import { Controller, Get, Post, Patch, Delete, Query, Body, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionGuard } from '../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../decorators/current-user.decorator';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import {
  updateProfileSchema,
  UpdateProfileDto,
  ordersQuerySchema,
  OrdersQueryDto,
  requestRefundSchema,
  RequestRefundDto,
  changePasswordSchema,
  ChangePasswordDto,
} from './schemas/account.schema';
import { AccountService } from './account.service';
import type { ProfileRecord, SubscriptionDetailRecord, OrdersResult, PurchaseRecord } from './account.service';
import type { Express } from 'express';

@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<{ data: ProfileRecord }> {
    const profile = await this.accountService.getProfile(user.id);

    return { data: profile };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto,
  ): Promise<{ success: boolean }> {
    await this.accountService.updateProfile(user.id, {
      ...(body.first_name !== undefined && { first_name: body.first_name }),
      ...(body.last_name !== undefined && { last_name: body.last_name }),
    });

    return { success: true };
  }

  @Get('subscription')
  async getSubscription(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDetailRecord> {
    return this.accountService.getSubscription(user.id);
  }

  @Get('orders')
  async getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ordersQuerySchema)) query: OrdersQueryDto,
  ): Promise<OrdersResult> {
    return this.accountService.getOrders(user.id, query.page, query.limit);
  }

  @Get('purchases')
  async getPurchases(@CurrentUser() user: AuthenticatedUser): Promise<{ data: PurchaseRecord[] }> {
    const purchases = await this.accountService.getPurchases(user.id);

    return { data: purchases };
  }

  @Post('refund')
  async requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(requestRefundSchema)) body: RequestRefundDto,
  ): Promise<{ success: boolean }> {
    await this.accountService.requestRefund(user.id, body.order_id, body.reason);

    return { success: true };
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    await this.accountService.changePassword(user.id, body.current_password, body.new_password);

    return { success: true };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    return this.accountService.uploadAvatar(user.id, file.buffer, file.mimetype, file.originalname);
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean }> {
    await this.accountService.removeAvatar(user.id);

    return { success: true };
  }
}

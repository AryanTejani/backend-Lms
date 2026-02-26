import { Controller, Post, Get, Patch, Param, Body, Query, UsePipes } from '@nestjs/common';
import { StaffRepository } from '@app/auth/repositories/staff.repository';
import { StaffSessionRepository } from '@app/auth/repositories/staff-session.repository';
import { AdminSessionCacheService } from '@app/auth/services/admin-session-cache.service';
import { hashPassword } from '@app/shared/utils/crypto.util';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Roles } from '../../../guards/role.guard';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createAdminUserSchema, updateAdminUserSchema, CreateAdminUserInput, UpdateAdminUserInput } from '../schemas/admin-user.schema';

interface StaffResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: Date;
}

interface StaffDetailResponse extends StaffResponse {
  bio: string | null;
  avatar_url: string | null;
}

@Controller('admin-users')
@Roles('admin')
export class AdminUserController {
  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly staffSessionRepository: StaffSessionRepository,
    private readonly adminSessionCacheService: AdminSessionCacheService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createAdminUserSchema))
  async create(@Body() body: CreateAdminUserInput): Promise<StaffResponse> {
    const existing = await this.staffRepository.findByEmail(body.email);

    if (existing) {
      throw Errors.emailAlreadyInUse();
    }

    const passwordHash = await hashPassword(body.password);

    const staff = await this.staffRepository.create({
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
    });

    return {
      id: staff.id,
      email: staff.email,
      first_name: staff.first_name,
      last_name: staff.last_name,
      role: staff.role,
      is_active: staff.is_active,
      created_at: staff.created_at,
    };
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: StaffResponse[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const result = await this.staffRepository.findAll({ page: pageNum, limit: limitNum });

    return {
      data: result.data.map((s) => ({
        id: s.id,
        email: s.email,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
        is_active: s.is_active,
        created_at: s.created_at,
      })),
      total: result.total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminUserSchema)) body: UpdateAdminUserInput,
  ): Promise<StaffDetailResponse> {
    const staff = await this.staffRepository.findById(id);

    if (!staff) {
      throw Errors.adminNotFound();
    }

    const updated = await this.staffRepository.update(id, body);

    return {
      id: updated.id,
      email: updated.email,
      first_name: updated.first_name,
      last_name: updated.last_name,
      role: updated.role,
      is_active: updated.is_active,
      bio: updated.bio,
      avatar_url: updated.avatar_url,
      created_at: updated.created_at,
    };
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    if (admin.id === id) {
      throw Errors.cannotDeactivateSelf();
    }

    const staff = await this.staffRepository.findById(id);

    if (!staff) {
      throw Errors.adminNotFound();
    }

    await this.staffRepository.deactivate(id);

    // Revoke all sessions and clear cache
    await this.staffSessionRepository.revokeAllForStaff(id);
    await this.adminSessionCacheService.invalidateAllForStaff(id);

    return { success: true };
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string): Promise<{ success: boolean }> {
    const staff = await this.staffRepository.findById(id);

    if (!staff) {
      throw Errors.adminNotFound();
    }

    await this.staffRepository.activate(id);

    return { success: true };
  }
}

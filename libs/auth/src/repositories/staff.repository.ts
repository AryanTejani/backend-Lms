import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { StaffUser } from '../types/admin-auth.types';

/**
 * Staff Repository
 * Uses Prisma for CRUD operations against the staff table
 */
@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<StaffUser | null> {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
    });

    if (!staff) {
      return null;
    }

    return this.mapToStaffUser(staff);
  }

  async findById(id: string): Promise<StaffUser | null> {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      return null;
    }

    return this.mapToStaffUser(staff);
  }

  async create(params: {
    email: string;
    passwordHash: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    role: 'ADMIN' | 'INSTRUCTOR';
  }): Promise<StaffUser> {
    const id = generateUuidV7();
    const staff = await this.prisma.staff.create({
      data: {
        id,
        email: params.email,
        passwordHash: params.passwordHash,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        role: params.role,
      },
    });

    return this.mapToStaffUser(staff);
  }

  async findAll(params: { page: number; limit: number }): Promise<{ data: StaffUser[]; total: number }> {
    const skip = (params.page - 1) * params.limit;

    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.staff.count(),
    ]);

    return {
      data: staff.map((s) => this.mapToStaffUser(s)),
      total,
    };
  }

  async update(
    id: string,
    data: {
      firstName?: string | undefined;
      lastName?: string | undefined;
      bio?: string | undefined;
      avatarUrl?: string | undefined;
    },
  ): Promise<StaffUser> {
    const updateData: Record<string, string> = {};

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }

    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    const staff = await this.prisma.staff.update({
      where: { id },
      data: updateData,
    });

    return this.mapToStaffUser(staff);
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string): Promise<void> {
    await this.prisma.staff.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.staff.update({
      where: { id },
      data: { passwordHash },
    });
  }

  private mapToStaffUser(staff: {
    id: string;
    email: string;
    passwordHash: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): StaffUser {
    return {
      id: staff.id,
      email: staff.email,
      password_hash: staff.passwordHash,
      first_name: staff.firstName,
      last_name: staff.lastName,
      role: staff.role as 'admin' | 'instructor',
      is_active: staff.isActive,
      bio: staff.bio,
      avatar_url: staff.avatarUrl,
      created_at: staff.createdAt,
      updated_at: staff.updatedAt,
    };
  }
}

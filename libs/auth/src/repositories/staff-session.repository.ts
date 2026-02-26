import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { StaffSession, StaffSessionWithUser } from '../types/admin-auth.types';

/**
 * Staff Session Repository
 * Mirrors SessionRepository pattern for staff auth
 */
@Injectable()
export class StaffSessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(staffId: string): Promise<StaffSession> {
    const id = generateUuidV7();
    const session = await this.prisma.staffSession.create({
      data: {
        id,
        staffId,
      },
    });

    return this.mapToStaffSession(session);
  }

  /**
   * Find active session with staff (HOT PATH - raw SQL)
   */
  async findActiveWithStaff(sessionId: string): Promise<StaffSessionWithUser | null> {
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        staff_id: string;
        created_at: Date;
        revoked_at: Date | null;
        staff_email: string;
        staff_first_name: string | null;
        staff_last_name: string | null;
        staff_role: string;
        staff_is_active: boolean;
        staff_bio: string | null;
        staff_avatar_url: string | null;
        staff_created_at: Date;
        staff_updated_at: Date;
      }>
    >`
      SELECT ss.id, ss.staff_id, ss.created_at, ss.revoked_at,
             s.email as staff_email,
             s.first_name as staff_first_name, s.last_name as staff_last_name,
             s.role::text as staff_role, s.is_active as staff_is_active,
             s.bio as staff_bio, s.avatar_url as staff_avatar_url,
             s.created_at as staff_created_at, s.updated_at as staff_updated_at
      FROM staff_sessions ss
      JOIN staff s ON ss.staff_id = s.id
      WHERE ss.id = ${sessionId}::uuid AND ss.revoked_at IS NULL
        AND ss.created_at > NOW() - INTERVAL '1 day' * ${this.configService.get<number>('session.maxAgeDays') ?? 7}
    `;

    const row = result[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      staff_id: row.staff_id,
      created_at: row.created_at,
      revoked_at: row.revoked_at,
      staff: {
        id: row.staff_id,
        email: row.staff_email,
        first_name: row.staff_first_name,
        last_name: row.staff_last_name,
        role: row.staff_role as 'admin' | 'instructor',
        is_active: row.staff_is_active,
        bio: row.staff_bio,
        avatar_url: row.staff_avatar_url,
        created_at: row.staff_created_at,
        updated_at: row.staff_updated_at,
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.staffSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForStaff(staffId: string): Promise<number> {
    const result = await this.prisma.staffSession.updateMany({
      where: {
        staffId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  private mapToStaffSession(session: { id: string; staffId: string; createdAt: Date; revokedAt: Date | null }): StaffSession {
    return {
      id: session.id,
      staff_id: session.staffId,
      created_at: session.createdAt,
      revoked_at: session.revokedAt,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { generateUuidV7 } from '@/shared/utils/uuid.util';
import { Session, SessionWithCustomer } from '../../domain/types/auth.types';

/**
 * Session Repository
 * Hybrid approach:
 * - Prisma for simple CRUD (create, revoke, revokeAllForCustomer)
 * - Raw SQL for hot paths (findActiveWithCustomer) and batch operations (cleanup)
 */
@Injectable()
export class SessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(customerId: string): Promise<Session> {
    const id = generateUuidV7();
    const session = await this.prisma.session.create({
      data: {
        id,
        customerId,
      },
    });

    return this.mapToSession(session);
  }

  /**
   * Find active session with customer (HOT PATH - preserved raw query)
   * This is the most called query, so we keep it optimized with raw SQL
   */
  async findActiveWithCustomer(sessionId: string): Promise<SessionWithCustomer | null> {
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        customer_id: string;
        created_at: Date;
        revoked_at: Date | null;
        customer_email: string;
        customer_password_hash: string | null;
        customer_first_name: string | null;
        customer_last_name: string | null;
        customer_stripe_customer_id: string | null;
        customer_requires_password_reset: boolean;
        customer_created_at: Date;
        customer_updated_at: Date;
      }>
    >`
      SELECT s.id, s.customer_id, s.created_at, s.revoked_at,
             c.email as customer_email, c.password_hash as customer_password_hash,
             c.first_name as customer_first_name, c.last_name as customer_last_name,
             c.stripe_customer_id as customer_stripe_customer_id,
             c.requires_password_reset as customer_requires_password_reset,
             c.created_at as customer_created_at, c.updated_at as customer_updated_at
      FROM sessions s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ${sessionId}::uuid AND s.revoked_at IS NULL
    `;

    const row = result[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      customer_id: row.customer_id,
      created_at: row.created_at,
      revoked_at: row.revoked_at,
      customer: {
        id: row.customer_id,
        email: row.customer_email,
        password_hash: row.customer_password_hash,
        first_name: row.customer_first_name,
        last_name: row.customer_last_name,
        stripe_customer_id: row.customer_stripe_customer_id,
        requires_password_reset: row.customer_requires_password_reset,
        created_at: row.customer_created_at,
        updated_at: row.customer_updated_at,
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForCustomer(customerId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        customerId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  /**
   * Cleanup old sessions (used by session cleanup job)
   * Batch deletes to avoid long-running transactions - uses raw SQL for LIMIT
   */
  async cleanupRevoked(retentionDays: number, batchSize: number): Promise<number> {
    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.prisma.$executeRaw`
        DELETE FROM sessions
        WHERE id IN (
          SELECT id FROM sessions
          WHERE revoked_at IS NOT NULL
          AND revoked_at < NOW() - INTERVAL '1 day' * ${retentionDays}
          LIMIT ${batchSize}
        )
      `;

      deletedCount += result;
      hasMore = result === batchSize;
    }

    return deletedCount;
  }

  async cleanupExpired(maxAgeDays: number, batchSize: number): Promise<number> {
    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.prisma.$executeRaw`
        DELETE FROM sessions
        WHERE id IN (
          SELECT id FROM sessions
          WHERE created_at < NOW() - INTERVAL '1 day' * ${maxAgeDays + 1}
          LIMIT ${batchSize}
        )
      `;

      deletedCount += result;
      hasMore = result === batchSize;
    }

    return deletedCount;
  }

  /**
   * Map Prisma Session model to domain Session type
   */
  private mapToSession(session: {
    id: string;
    customerId: string;
    createdAt: Date;
    revokedAt: Date | null;
  }): Session {
    return {
      id: session.id,
      customer_id: session.customerId,
      created_at: session.createdAt,
      revoked_at: session.revokedAt,
    };
  }
}

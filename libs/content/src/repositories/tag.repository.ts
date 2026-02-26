import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
  post_count: number;
}

@Injectable()
export class TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TagRecord[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      post_count: t._count.posts,
    }));
  }

  async findById(id: string): Promise<TagRecord | null> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (!tag) {
      return null;
    }

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      created_at: tag.createdAt,
      updated_at: tag.updatedAt,
      post_count: tag._count.posts,
    };
  }
}

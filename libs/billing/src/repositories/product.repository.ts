import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import type { ProductContentType } from '@prisma/client';

export interface ProductRecord {
  id: string;
  product_name: string;
  product_slug: string | null;
  amount_cents: number;
  currency: string;
  content_type: string;
  is_active: boolean;
}

const CONTENT_TYPE_MAP: Record<ProductContentType, string> = {
  COURSE: 'course',
  MASTER_CLASS: 'master_class',
  BUNDLE: 'bundle',
  DIGITAL_DOWNLOAD: 'digital_download',
};

const CONTENT_TYPE_TO_PRISMA: Record<string, ProductContentType> = {
  course: 'COURSE',
  master_class: 'MASTER_CLASS',
  bundle: 'BUNDLE',
  digital_download: 'DIGITAL_DOWNLOAD',
};

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: { contentType?: string; isActive?: boolean }): Promise<ProductRecord[]> {
    const where: Record<string, unknown> = {};

    if (filters?.contentType) {
      const prismaType = CONTENT_TYPE_TO_PRISMA[filters.contentType];

      if (prismaType) {
        where.contentType = prismaType;
      }
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { productName: 'asc' },
    });

    return products.map((p) => this.mapToRecord(p));
  }

  private mapToRecord(product: {
    id: string;
    productName: string;
    productSlug: string | null;
    amountCents: bigint;
    currency: string;
    contentType: ProductContentType;
    isActive: boolean;
  }): ProductRecord {
    return {
      id: product.id,
      product_name: product.productName,
      product_slug: product.productSlug,
      amount_cents: Number(product.amountCents),
      currency: product.currency,
      content_type: CONTENT_TYPE_MAP[product.contentType],
      is_active: product.isActive,
    };
  }
}

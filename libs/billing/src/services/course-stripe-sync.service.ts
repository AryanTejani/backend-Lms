import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { StripeService } from './stripe.service';

@Injectable()
export class CourseStripeSyncService {
  private readonly logger = new Logger(CourseStripeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async syncProductToStripe(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null) {
      throw Errors.productNotFound();
    }

    // Skip free products
    if (Number(product.amountCents) === 0) {
      return;
    }

    // Skip if already synced
    if (product.stripeProductId && product.stripePriceId) {
      return;
    }

    try {
      let stripeProductId = product.stripeProductId;

      if (!stripeProductId) {
        const stripeProduct = await this.stripeService.createProduct({
          name: product.productName,
          ...(product.productDescription && { description: product.productDescription }),
          metadata: { traderlion_product_id: product.id },
        });

        stripeProductId = stripeProduct.id;
      }

      const stripePrice = await this.stripeService.createOneTimePrice({
        productId: stripeProductId,
        unitAmount: Number(product.amountCents),
        currency: product.currency,
      });

      await this.prisma.product.update({
        where: { id: productId },
        data: {
          stripeProductId,
          stripePriceId: stripePrice.id,
        },
      });

      this.logger.log(`Synced product ${productId} to Stripe: ${stripeProductId} / ${stripePrice.id}`);
    } catch (error) {
      this.logger.error(`Failed to sync product ${productId} to Stripe`, error);
      throw Errors.stripePlanSyncFailed('Failed to sync course product to Stripe');
    }
  }

  async updateStripePrice(productId: string, newAmountCents: number): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null) {
      throw Errors.productNotFound();
    }

    if (!product.stripeProductId || !product.stripePriceId) {
      this.logger.warn(`Product ${productId} has no Stripe IDs — skipping price update`);

      return;
    }

    try {
      // Create new price
      const newPrice = await this.stripeService.createOneTimePrice({
        productId: product.stripeProductId,
        unitAmount: newAmountCents,
        currency: product.currency,
      });

      // Archive old price
      await this.stripeService.archivePrice(product.stripePriceId);

      // Update local record
      await this.prisma.product.update({
        where: { id: productId },
        data: { stripePriceId: newPrice.id },
      });

      this.logger.log(`Updated Stripe price for product ${productId}: ${newPrice.id}`);
    } catch (error) {
      this.logger.error(`Failed to update Stripe price for product ${productId}`, error);
      throw Errors.stripePlanSyncFailed('Failed to update course price in Stripe');
    }
  }
}

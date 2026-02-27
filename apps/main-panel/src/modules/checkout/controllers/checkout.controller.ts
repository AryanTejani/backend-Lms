import { Controller, Get, Post, Body, Req, Logger, HttpCode, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CheckoutService, WebhookService, StripeService } from '@app/billing';
import type { SubscriptionPlanRecord } from '@app/billing';
import { Public } from '@app/shared/decorators/public.decorator';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { CurrentUser, AuthenticatedUser } from '../../../decorators/current-user.decorator';
import { SessionGuard } from '../../../guards/session.guard';
import {
  createCheckoutSessionSchema,
  CreateCheckoutSessionDto,
  createCourseCheckoutSessionSchema,
  CreateCourseCheckoutSessionDto,
} from '../schemas/checkout.schema';

@Controller()
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly webhookService: WebhookService,
    private readonly stripeService: StripeService,
  ) {}

  @Get('plans')
  @Public()
  async listPlans(): Promise<{ data: SubscriptionPlanRecord[] }> {
    const plans = await this.checkoutService.getActivePlans();

    return { data: plans };
  }

  @Post('checkout/session')
  @UseGuards(SessionGuard)
  async createCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCheckoutSessionSchema)) body: CreateCheckoutSessionDto,
  ): Promise<{ checkout_url: string }> {
    return this.checkoutService.createCheckoutSession(user.id, body.price_id, body.promotion_code);
  }

  @Post('checkout/course-session')
  @UseGuards(SessionGuard)
  async createCourseCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCourseCheckoutSessionSchema)) body: CreateCourseCheckoutSessionDto,
  ): Promise<{ checkout_url: string }> {
    return this.checkoutService.createCourseCheckoutSession(user.id, body.product_id, body.promotion_code);
  }

  @Post('checkout/portal')
  @UseGuards(SessionGuard)
  async createPortalSession(@CurrentUser() user: AuthenticatedUser): Promise<{ portal_url: string }> {
    return this.checkoutService.createPortalSession(user.id);
  }

  @Get('checkout/subscription-status')
  @UseGuards(SessionGuard)
  async getSubscriptionStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    has_active_subscription: boolean;
    subscription: {
      status: string;
      plan_name: string | null;
      current_period_end: Date;
    } | null;
  }> {
    return this.checkoutService.getSubscriptionStatus(user.id);
  }

  @Post('webhooks/stripe')
  @Public()
  @HttpCode(200)
  async handleStripeWebhook(@Req() req: Request): Promise<{ received: boolean }> {
    const signature = req.headers['stripe-signature'];
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    this.logger.log(`[Webhook] hit — signature: ${!!signature}, rawBody: ${!!rawBody}, rawBodyLen: ${rawBody?.length}`);

    if (!signature || typeof signature !== 'string') {
      throw Errors.stripeWebhookInvalid();
    }

    if (!rawBody) {
      throw Errors.stripeWebhookInvalid();
    }

    let event;

    try {
      event = await this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw Errors.stripeWebhookInvalid();
    }

    try {
      await this.webhookService.handleEvent(event);
    } catch (error) {
      this.logger.error(`Error handling webhook event ${event.type}`, error);
      throw error; // Don't swallow — let it 500 so Stripe CLI shows the failure
    }

    return { received: true };
  }
}

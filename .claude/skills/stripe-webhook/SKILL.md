---
description: Use when adding a Stripe webhook endpoint, any third-party webhook, or any endpoint requiring raw request body access and signature validation
---

# Stripe Webhook Endpoint

## Requirements

1. Must be `@Public()` — webhook receivers are unauthenticated
2. Must use `@HttpCode(200)` — always return 200
3. Needs raw body access (`req.rawBody: Buffer`)
4. Validate signature before processing; return 400 on invalid signature
5. Return 200 even when handler errors occur (prevents Stripe retry storm)

## Full Pattern

```ts
import { Controller, Post, Req, Logger, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { WebhookService, StripeService } from '@app/billing';
import { Public } from '@app/shared/decorators/public.decorator';
import { Errors } from '@app/shared/exceptions/auth.exception';

@Controller()
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('webhooks/stripe')
  @Public()
  @HttpCode(200)
  async handleStripeWebhook(@Req() req: Request): Promise<{ received: boolean }> {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      throw Errors.stripeWebhookInvalid();
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      throw Errors.stripeWebhookInvalid();
    }

    let event;

    try {
      event = await this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw Errors.stripeWebhookInvalid();  // 400 — bad signature
    }

    try {
      await this.webhookService.handleEvent(event);
    } catch (error) {
      this.logger.error(`Error handling webhook event ${event.type}`, error);
      // DO NOT rethrow — return 200 to prevent Stripe retry storm
    }

    return { received: true };
  }
}
```

## Fan-out in WebhookService

`WebhookService` in `@app/billing` routes events to handlers by `event.type`:

```ts
@Injectable()
export class WebhookService {
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object);
        break;
      // ...
    }
  }
}
```

## Atomic Writes in Handlers

When a handler must create multiple related records atomically, use `prisma.$transaction()`.
Always check for existing records first (idempotency) before writing.

```ts
async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // 1. Idempotency check — return early if already processed
  const existing = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubId);
  if (existing) return;

  // 2. Atomic multi-record write
  await this.prisma.$transaction(async (tx) => {
    const subscription = await this.subscriptionRepository.create({ ... });

    for (const item of lineItems) {
      await tx.purchase.create({ data: { id: generateUuidV7(), subscriptionId: subscription.id, ... } });
    }

    await tx.customer.update({
      where: { id: customerId },
      data: { activeSubscriptions: { increment: 1 } },
    });
  });
}
```

Key rules:
- Check idempotency **before** the transaction to avoid duplicate records on Stripe retries
- Inside `$transaction`, use the `tx` client (not `this.prisma`) for all writes
- Pass `tx` down to repository methods that need it, or inline the writes
- Reference: `libs/billing/src/services/webhook.service.ts`

## Checklist

- [ ] Endpoint is `@Public()` and `@HttpCode(200)`
- [ ] `stripe-signature` header validated before constructing event
- [ ] `rawBody: Buffer` extracted from request (not parsed JSON body)
- [ ] Signature verification in try/catch — throw `stripeWebhookInvalid()` on failure
- [ ] Handler errors logged but NOT rethrown (return 200 always)
- [ ] Event routing delegated to `WebhookService.handleEvent()`

## Reference

`apps/main-panel/src/modules/checkout/controllers/checkout.controller.ts`

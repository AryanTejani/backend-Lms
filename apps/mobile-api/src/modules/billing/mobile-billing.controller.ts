import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { CheckoutService, SubscriptionPlanRecord } from '@app/billing';
import { Public } from '@app/shared/decorators/public.decorator';
import { SessionGuard } from '../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../decorators/current-user.decorator';

@Controller('billing')
@UseGuards(SessionGuard)
export class MobileBillingController {
    private readonly logger = new Logger(MobileBillingController.name);

    constructor(
        private readonly checkoutService: CheckoutService,
    ) { }

    @Get('plans')
    @Public()
    async listPlans(): Promise<{ data: SubscriptionPlanRecord[] }> {
        const plans = await this.checkoutService.getActivePlans();
        return { data: plans };
    }

    @Post('checkout/session')
    async createCheckoutSession(
        @CurrentUser() user: AuthenticatedUser,
        @Body() body: { price_id: string; promotion_code?: string },
    ): Promise<{ checkout_url: string }> {
        return this.checkoutService.createCheckoutSession(user.id, body.price_id, body.promotion_code);
    }

    @Post('checkout/course-session')
    async createCourseCheckoutSession(
        @CurrentUser() user: AuthenticatedUser,
        @Body() body: { product_id: string; promotion_code?: string },
    ): Promise<{ checkout_url: string }> {
        return this.checkoutService.createCourseCheckoutSession(user.id, body.product_id, body.promotion_code);
    }

    @Get('subscription/status')
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
}

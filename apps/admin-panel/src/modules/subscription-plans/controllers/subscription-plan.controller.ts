import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { SubscriptionPlanService } from '@app/billing/services/subscription-plan.service';
import type { SubscriptionPlanRecord } from '@app/billing/repositories/subscription-plan.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
} from '../schemas/subscription-plan.schema';

@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) {}

  @Get()
  async findAll(@Query('include_archived') includeArchived?: string): Promise<SubscriptionPlanRecord[]> {
    return this.planService.findAll({
      include_archived: includeArchived === 'true',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SubscriptionPlanRecord> {
    return this.planService.findById(id);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createSubscriptionPlanSchema)) body: CreateSubscriptionPlanInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<SubscriptionPlanRecord> {
    return this.planService.create({
      name: body.name,
      slug: body.slug,
      description: body.description,
      amount_cents: body.amount_cents,
      currency: body.currency,
      recurring_interval: body.recurring_interval,
      recurring_interval_count: body.recurring_interval_count,
      trial_days: body.trial_days,
      is_active: body.is_active,
      created_by_staff_id: admin.id,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSubscriptionPlanSchema)) body: UpdateSubscriptionPlanInput,
  ): Promise<SubscriptionPlanRecord> {
    return this.planService.update(id, body);
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string): Promise<SubscriptionPlanRecord> {
    return this.planService.archive(id);
  }

  @Post(':id/unarchive')
  async unarchive(@Param('id') id: string): Promise<SubscriptionPlanRecord> {
    return this.planService.unarchive(id);
  }

  @Post(':id/sync-stripe')
  async syncToStripe(@Param('id') id: string): Promise<SubscriptionPlanRecord> {
    return this.planService.syncToStripe(id);
  }
}

import { Controller, Post, Patch, Body, UseGuards, Logger } from '@nestjs/common';
import { CustomerRepository } from '@app/auth/repositories/customer.repository';
import { SessionGuard } from '../../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../../decorators/current-user.decorator';
import { saveOnboardingSchema, updatePreferenceSchema } from '../schemas/onboarding.schema';
import { Errors } from '@app/shared/exceptions/auth.exception';

@Controller('customers/me')
@UseGuards(SessionGuard)
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly customerRepository: CustomerRepository) {}

  @Post('onboarding')
  async saveOnboarding(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<{ success: boolean }> {
    this.logger.log(`[POST /onboarding] Raw body: ${JSON.stringify(body)}`);

    const result = saveOnboardingSchema.safeParse(body);

    if (!result.success) {
      this.logger.error(`[POST /onboarding] Validation failed: ${JSON.stringify(result.error.issues)}`);

      throw Errors.validationError(result.error.issues[0]?.message ?? 'Validation failed');
    }

    const data = result.data;

    this.logger.log(`[POST /onboarding] Parsed data: ${JSON.stringify(data)}`);

    await this.customerRepository.saveOnboarding(user.id, {
      languagePreference: data.languagePreference ?? 'en',
      age: data.age ?? null,
      grade: data.grade ?? null,
      subjects: data.subjects,
      learningGoals: data.learningGoals,
    });

    return { success: true };
  }

  @Patch('preferences')
  async updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<{ success: boolean }> {
    this.logger.log(`[PATCH /preferences] Raw body: ${JSON.stringify(body)}`);

    const result = updatePreferenceSchema.safeParse(body);

    if (!result.success) {
      this.logger.error(`[PATCH /preferences] Validation failed: ${JSON.stringify(result.error.issues)}`);

      throw Errors.validationError(result.error.issues[0]?.message ?? 'Validation failed');
    }

    await this.customerRepository.updateLanguagePreference(user.id, result.data.languagePreference);

    return { success: true };
  }
}

import { Controller, Get, Patch, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { CustomerRepository } from '@app/auth/repositories/customer.repository';
import { SessionGuard } from '../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../decorators/current-user.decorator';

@Controller('customer')
@UseGuards(SessionGuard)
export class MobileCustomerController {
    private readonly logger = new Logger(MobileCustomerController.name);

    constructor(private readonly customerRepository: CustomerRepository) { }

    @Get('me')
    async getProfile(@CurrentUser() user: AuthenticatedUser) {
        return this.customerRepository.findById(user.id);
    }

    @Patch('me')
    async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
        // Simplified profile update for mobile
        return this.customerRepository.update(user.id, body);
    }

    @Post('onboarding')
    async saveOnboarding(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
        this.logger.log(`[MobileCustomerController] User: ${JSON.stringify(user)}`);
        this.logger.log(`Saving onboarding for user ${user.id}: ${JSON.stringify(body)}`);

        await this.customerRepository.saveOnboarding(user.id, {
            languagePreference: body.languagePreference || 'en',
            age: body.age || null,
            grade: body.grade || null,
            subjects: body.subjects || [],
            learningGoals: body.learningGoals || [],
        });

        return { success: true };
    }

    @Patch('preferences')
    async updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: { languagePreference: string }) {
        await this.customerRepository.updateLanguagePreference(user.id, body.languagePreference);
        return { success: true };
    }
}

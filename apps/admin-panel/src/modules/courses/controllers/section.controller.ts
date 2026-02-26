import { Controller, Post, Get, Patch, Put, Delete, Param, Body } from '@nestjs/common';
import { SectionService } from '@app/content/services/section.service';
import type { SectionRecord } from '@app/content/repositories/section.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createSectionSchema, updateSectionSchema, reorderSectionsSchema } from '../schemas/section.schema';
import type { CreateSectionInput, UpdateSectionInput, ReorderSectionsInput } from '../schemas/section.schema';

@Controller('courses/:productId/sections')
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  @Post()
  async create(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createSectionSchema)) body: CreateSectionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<SectionRecord> {
    return this.sectionService.addSection(productId, admin, {
      title: body.title,
      description: body.description,
    });
  }

  @Get()
  async findAll(@Param('productId') productId: string): Promise<SectionRecord[]> {
    return this.sectionService.listSections(productId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SectionRecord> {
    return this.sectionService.getSection(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSectionSchema)) body: UpdateSectionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<SectionRecord> {
    return this.sectionService.updateSection(id, admin, {
      title: body.title,
      description: body.description,
      isPublished: body.is_published,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.sectionService.removeSection(id, admin);

    return { success: true };
  }

  @Put('reorder')
  async reorder(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(reorderSectionsSchema)) body: ReorderSectionsInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<SectionRecord[]> {
    return this.sectionService.reorderSections(productId, admin, body.section_ids);
  }
}

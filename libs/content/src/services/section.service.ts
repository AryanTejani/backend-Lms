import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { SectionRepository, SectionRecord } from '../repositories/section.repository';
import { CourseProductService } from './course-product.service';

@Injectable()
export class SectionService {
  constructor(
    private readonly sectionRepository: SectionRepository,
    private readonly courseProductService: CourseProductService,
  ) {}

  async addSection(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title: string;
      description?: string | undefined;
    },
  ): Promise<SectionRecord> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.sectionRepository.create({
      productId,
      title: input.title,
      description: input.description,
    });
  }

  async getSection(id: string): Promise<SectionRecord> {
    const section = await this.sectionRepository.findById(id);

    if (!section) {
      throw Errors.sectionNotFound();
    }

    return section;
  }

  async listSections(productId: string): Promise<SectionRecord[]> {
    return this.sectionRepository.findByProductId(productId);
  }

  async updateSection(
    sectionId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      description?: string | null | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<SectionRecord> {
    const section = await this.sectionRepository.findById(sectionId);

    if (!section) {
      throw Errors.sectionNotFound();
    }

    const course = await this.courseProductService.getCourse(section.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.sectionRepository.update(sectionId, input);
  }

  async removeSection(sectionId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const section = await this.sectionRepository.findById(sectionId);

    if (!section) {
      throw Errors.sectionNotFound();
    }

    const course = await this.courseProductService.getCourse(section.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.sectionRepository.delete(sectionId);
  }

  async reorderSections(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    sectionIds: string[],
  ): Promise<SectionRecord[]> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    const existingSections = await this.sectionRepository.findByProductId(productId);
    const existingIds = new Set(existingSections.map((s) => s.id));

    for (const id of sectionIds) {
      if (!existingIds.has(id)) {
        throw Errors.sectionNotFound();
      }
    }

    await this.sectionRepository.reorder(sectionIds);

    return this.sectionRepository.findByProductId(productId);
  }
}

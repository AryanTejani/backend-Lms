import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { QuizRepository, QuizRecord, QuizQuestionRecord, QuizQuestionOptionRecord } from '../repositories/quiz.repository';
import { CourseProductService } from './course-product.service';

@Injectable()
export class QuizService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly courseProductService: CourseProductService,
  ) {}

  // ─── Quiz ────────────────────────────────────────────────────

  async addQuiz(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title: string;
      description?: string | undefined;
      passingPercentage?: number | undefined;
      timeLimitSeconds?: number | undefined;
      sectionId?: string | undefined;
    },
  ): Promise<QuizRecord> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.create({
      productId,
      title: input.title,
      description: input.description,
      passingPercentage: input.passingPercentage,
      timeLimitSeconds: input.timeLimitSeconds,
      sectionId: input.sectionId,
    });
  }

  async getQuiz(id: string): Promise<QuizRecord> {
    const quiz = await this.quizRepository.findById(id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    return quiz;
  }

  async listQuizzes(productId: string): Promise<QuizRecord[]> {
    return this.quizRepository.findByProductId(productId);
  }

  async updateQuiz(
    quizId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      description?: string | null | undefined;
      passingPercentage?: number | undefined;
      timeLimitSeconds?: number | null | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<QuizRecord> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.update(quizId, input);
  }

  async removeQuiz(quizId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.quizRepository.delete(quizId);
  }

  async reorderQuizzes(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    quizIds: string[],
  ): Promise<QuizRecord[]> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    const existingQuizzes = await this.quizRepository.findByProductId(productId);
    const existingIds = new Set(existingQuizzes.map((q) => q.id));

    for (const id of quizIds) {
      if (!existingIds.has(id)) {
        throw Errors.quizNotFound();
      }
    }

    await this.quizRepository.reorder(quizIds);

    return this.quizRepository.findByProductId(productId);
  }

  // ─── Questions ───────────────────────────────────────────────

  async addQuestion(
    quizId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      questionText: string;
      questionType?: string | undefined;
      points?: number | undefined;
      hint?: string | undefined;
    },
  ): Promise<QuizQuestionRecord> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.createQuestion({
      quizId,
      questionText: input.questionText,
      questionType: input.questionType,
      points: input.points,
      hint: input.hint,
    });
  }

  async updateQuestion(
    questionId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      questionText?: string | undefined;
      questionType?: string | undefined;
      points?: number | undefined;
      hint?: string | null | undefined;
    },
  ): Promise<QuizQuestionRecord> {
    const question = await this.quizRepository.findQuestionById(questionId);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.updateQuestion(questionId, input);
  }

  async removeQuestion(questionId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const question = await this.quizRepository.findQuestionById(questionId);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.quizRepository.deleteQuestion(questionId);
  }

  async reorderQuestions(
    quizId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    questionIds: string[],
  ): Promise<QuizQuestionRecord[]> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    if (quiz.questions) {
      const existingIds = new Set(quiz.questions.map((q) => q.id));

      for (const id of questionIds) {
        if (!existingIds.has(id)) {
          throw Errors.quizQuestionNotFound();
        }
      }
    }

    await this.quizRepository.reorderQuestions(questionIds);

    const updated = await this.quizRepository.findById(quizId);

    return updated!.questions ?? [];
  }

  // ─── Options ─────────────────────────────────────────────────

  async addOption(
    questionId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      optionText: string;
      isCorrect?: boolean | undefined;
    },
  ): Promise<QuizQuestionOptionRecord> {
    const question = await this.quizRepository.findQuestionById(questionId);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.createOption({
      questionId,
      optionText: input.optionText,
      isCorrect: input.isCorrect,
    });
  }

  async updateOption(
    optionId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      optionText?: string | undefined;
      isCorrect?: boolean | undefined;
    },
  ): Promise<QuizQuestionOptionRecord> {
    const option = await this.quizRepository.findOptionById(optionId);

    if (!option) {
      throw Errors.quizQuestionNotFound();
    }

    const question = await this.quizRepository.findQuestionById(option.question_id);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.quizRepository.updateOption(optionId, input);
  }

  async removeOption(optionId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const option = await this.quizRepository.findOptionById(optionId);

    if (!option) {
      throw Errors.quizQuestionNotFound();
    }

    const question = await this.quizRepository.findQuestionById(option.question_id);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.quizRepository.deleteOption(optionId);
  }

  async reorderOptions(
    questionId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    optionIds: string[],
  ): Promise<QuizQuestionOptionRecord[]> {
    const question = await this.quizRepository.findQuestionById(questionId);

    if (!question) {
      throw Errors.quizQuestionNotFound();
    }

    const quiz = await this.quizRepository.findById(question.quiz_id);

    if (!quiz) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    if (question.options) {
      const existingIds = new Set(question.options.map((o) => o.id));

      for (const id of optionIds) {
        if (!existingIds.has(id)) {
          throw Errors.quizQuestionNotFound();
        }
      }
    }

    await this.quizRepository.reorderOptions(optionIds);

    const updated = await this.quizRepository.findQuestionById(questionId);

    return updated!.options ?? [];
  }

  // ─── Customer-facing ─────────────────────────────────────────

  async getQuizForCustomer(quizId: string, customerId: string | undefined): Promise<QuizRecord> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz || !quiz.is_published) {
      throw Errors.quizNotFound();
    }

    const course = await this.courseProductService.getCourse(quiz.product_id);

    if (!course.is_published) {
      throw Errors.courseNotFound();
    }

    if (Number(course.amount_cents) > 0) {
      if (!customerId) {
        throw Errors.courseAccessDenied();
      }

      const hasAccess = await this.courseProductService.checkAccess(customerId, course.id);

      if (!hasAccess) {
        throw Errors.courseAccessDenied();
      }
    }

    return quiz;
  }

  async listQuizzesForCustomer(productId: string): Promise<QuizRecord[]> {
    return this.quizRepository.findByProductId(productId, true);
  }
}

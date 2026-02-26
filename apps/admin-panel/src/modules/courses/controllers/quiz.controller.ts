import { Controller, Post, Get, Patch, Put, Delete, Param, Body } from '@nestjs/common';
import { QuizService } from '@app/content/services/quiz.service';
import type { QuizRecord, QuizQuestionRecord, QuizQuestionOptionRecord } from '@app/content/repositories/quiz.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import {
  createQuizSchema, updateQuizSchema, reorderQuizzesSchema,
  createQuestionSchema, updateQuestionSchema, reorderQuestionsSchema,
  createOptionSchema, updateOptionSchema, reorderOptionsSchema,
} from '../schemas/quiz.schema';
import type {
  CreateQuizInput, UpdateQuizInput, ReorderQuizzesInput,
  CreateQuestionInput, UpdateQuestionInput, ReorderQuestionsInput,
  CreateOptionInput, UpdateOptionInput, ReorderOptionsInput,
} from '../schemas/quiz.schema';

@Controller('courses/:productId/quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // ─── Quiz endpoints ──────────────────────────────────────────

  @Post()
  async createQuiz(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) body: CreateQuizInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizRecord> {
    return this.quizService.addQuiz(productId, admin, {
      title: body.title,
      description: body.description,
      passingPercentage: body.passing_percentage,
      timeLimitSeconds: body.time_limit_seconds,
    });
  }

  @Get()
  async listQuizzes(@Param('productId') productId: string): Promise<QuizRecord[]> {
    return this.quizService.listQuizzes(productId);
  }

  @Get(':id')
  async getQuiz(@Param('id') id: string): Promise<QuizRecord> {
    return this.quizService.getQuiz(id);
  }

  @Patch(':id')
  async updateQuiz(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQuizSchema)) body: UpdateQuizInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizRecord> {
    return this.quizService.updateQuiz(id, admin, {
      title: body.title,
      description: body.description,
      passingPercentage: body.passing_percentage,
      timeLimitSeconds: body.time_limit_seconds,
      isPublished: body.is_published,
    });
  }

  @Delete(':id')
  async removeQuiz(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.quizService.removeQuiz(id, admin);

    return { success: true };
  }

  @Put('reorder')
  async reorderQuizzes(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(reorderQuizzesSchema)) body: ReorderQuizzesInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizRecord[]> {
    return this.quizService.reorderQuizzes(productId, admin, body.quiz_ids);
  }

  // ─── Question endpoints ──────────────────────────────────────

  @Post(':quizId/questions')
  async createQuestion(
    @Param('quizId') quizId: string,
    @Body(new ZodValidationPipe(createQuestionSchema)) body: CreateQuestionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionRecord> {
    return this.quizService.addQuestion(quizId, admin, {
      questionText: body.question_text,
      questionType: body.question_type,
      points: body.points,
      hint: body.hint,
    });
  }

  @Patch(':quizId/questions/:questionId')
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) body: UpdateQuestionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionRecord> {
    return this.quizService.updateQuestion(questionId, admin, {
      questionText: body.question_text,
      questionType: body.question_type,
      points: body.points,
      hint: body.hint,
    });
  }

  @Delete(':quizId/questions/:questionId')
  async removeQuestion(
    @Param('questionId') questionId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<{ success: boolean }> {
    await this.quizService.removeQuestion(questionId, admin);

    return { success: true };
  }

  @Put(':quizId/questions/reorder')
  async reorderQuestions(
    @Param('quizId') quizId: string,
    @Body(new ZodValidationPipe(reorderQuestionsSchema)) body: ReorderQuestionsInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionRecord[]> {
    return this.quizService.reorderQuestions(quizId, admin, body.question_ids);
  }

  // ─── Option endpoints ────────────────────────────────────────

  @Post(':quizId/questions/:questionId/options')
  async createOption(
    @Param('questionId') questionId: string,
    @Body(new ZodValidationPipe(createOptionSchema)) body: CreateOptionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionOptionRecord> {
    return this.quizService.addOption(questionId, admin, {
      optionText: body.option_text,
      isCorrect: body.is_correct,
    });
  }

  @Patch(':quizId/questions/:questionId/options/:optionId')
  async updateOption(
    @Param('optionId') optionId: string,
    @Body(new ZodValidationPipe(updateOptionSchema)) body: UpdateOptionInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionOptionRecord> {
    return this.quizService.updateOption(optionId, admin, {
      optionText: body.option_text,
      isCorrect: body.is_correct,
    });
  }

  @Delete(':quizId/questions/:questionId/options/:optionId')
  async removeOption(
    @Param('optionId') optionId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<{ success: boolean }> {
    await this.quizService.removeOption(optionId, admin);

    return { success: true };
  }

  @Put(':quizId/questions/:questionId/options/reorder')
  async reorderOptions(
    @Param('questionId') questionId: string,
    @Body(new ZodValidationPipe(reorderOptionsSchema)) body: ReorderOptionsInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<QuizQuestionOptionRecord[]> {
    return this.quizService.reorderOptions(questionId, admin, body.option_ids);
  }
}

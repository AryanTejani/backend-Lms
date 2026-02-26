import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { QuestionType } from '@prisma/client';

export interface QuizRecord {
  id: string;
  product_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  passing_percentage: number;
  time_limit_seconds: number | null;
  sort_order: number;
  section_name: string | null;
  is_published: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  questions?: QuizQuestionRecord[];
  question_count?: number;
}

export interface QuizQuestionRecord {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'single' | 'multiple';
  points: number;
  sort_order: number;
  hint: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  options?: QuizQuestionOptionRecord[];
}

export interface QuizQuestionOptionRecord {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
  created_at: Date;
}

const QUESTION_TYPE_MAP: Record<QuestionType, 'single' | 'multiple'> = {
  SINGLE: 'single',
  MULTIPLE: 'multiple',
};

const QUESTION_TYPE_TO_PRISMA: Record<string, QuestionType> = {
  single: 'SINGLE',
  multiple: 'MULTIPLE',
};

@Injectable()
export class QuizRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Quiz CRUD ───────────────────────────────────────────────

  async create(params: {
    productId: string;
    title: string;
    description?: string | undefined;
    passingPercentage?: number | undefined;
    timeLimitSeconds?: number | undefined;
    sectionId?: string | undefined;
    sortOrder?: number | undefined;
  }): Promise<QuizRecord> {
    const id = generateUuidV7();

    let sortOrder = params.sortOrder;

    if (sortOrder === undefined) {
      const maxSort = await this.prisma.quiz.aggregate({
        where: { productId: params.productId },
        _max: { sortOrder: true },
      });

      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        id,
        productId: params.productId,
        sectionId: params.sectionId ?? null,
        title: params.title,
        description: params.description ?? null,
        passingPercentage: params.passingPercentage ?? 80,
        timeLimitSeconds: params.timeLimitSeconds ?? null,
        sortOrder,
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return this.mapToRecord(quiz);
  }

  async findById(id: string): Promise<QuizRecord | null> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, deletedAt: null },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            options: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { questions: true } },
      },
    });

    if (!quiz) {
      return null;
    }

    return this.mapToRecord(quiz);
  }

  async findByProductId(productId: string, isPublished?: boolean): Promise<QuizRecord[]> {
    const where: Record<string, unknown> = { productId, deletedAt: null };

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const quizzes = await this.prisma.quiz.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return quizzes.map((q) => this.mapToRecord(q));
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      description?: string | null | undefined;
      passingPercentage?: number | undefined;
      timeLimitSeconds?: number | null | undefined;
      sortOrder?: number | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<QuizRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.passingPercentage !== undefined) {
      updateData.passingPercentage = data.passingPercentage;
    }

    if (data.timeLimitSeconds !== undefined) {
      updateData.timeLimitSeconds = data.timeLimitSeconds;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
    }

    const quiz = await this.prisma.quiz.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { questions: true } },
      },
    });

    return this.mapToRecord(quiz);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async reorder(quizIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      quizIds.map((id, index) =>
        this.prisma.quiz.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async publishByProductId(productId: string): Promise<void> {
    await this.prisma.quiz.updateMany({
      where: { productId },
      data: { isPublished: true },
    });
  }

  async unpublishByProductId(productId: string): Promise<void> {
    await this.prisma.quiz.updateMany({
      where: { productId },
      data: { isPublished: false },
    });
  }

  // ─── Question CRUD ───────────────────────────────────────────

  async createQuestion(params: {
    quizId: string;
    questionText: string;
    questionType?: string | undefined;
    points?: number | undefined;
    hint?: string | undefined;
  }): Promise<QuizQuestionRecord> {
    const id = generateUuidV7();

    const maxSort = await this.prisma.quizQuestion.aggregate({
      where: { quizId: params.quizId },
      _max: { sortOrder: true },
    });

    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const question = await this.prisma.quizQuestion.create({
      data: {
        id,
        quizId: params.quizId,
        questionText: params.questionText,
        questionType: QUESTION_TYPE_TO_PRISMA[params.questionType ?? 'single'] ?? 'SINGLE',
        points: params.points ?? 1,
        hint: params.hint ?? null,
        sortOrder,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return this.mapQuestionToRecord(question);
  }

  async findQuestionById(id: string): Promise<QuizQuestionRecord | null> {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id, deletedAt: null },
      include: {
        options: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!question) {
      return null;
    }

    return this.mapQuestionToRecord(question);
  }

  async updateQuestion(
    id: string,
    data: {
      questionText?: string | undefined;
      questionType?: string | undefined;
      points?: number | undefined;
      hint?: string | null | undefined;
    },
  ): Promise<QuizQuestionRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.questionText !== undefined) {
      updateData.questionText = data.questionText;
    }

    if (data.questionType !== undefined) {
      updateData.questionType = QUESTION_TYPE_TO_PRISMA[data.questionType] ?? 'SINGLE';
    }

    if (data.points !== undefined) {
      updateData.points = data.points;
    }

    if (data.hint !== undefined) {
      updateData.hint = data.hint;
    }

    const question = await this.prisma.quizQuestion.update({
      where: { id },
      data: updateData,
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return this.mapQuestionToRecord(question);
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.prisma.quizQuestion.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async reorderQuestions(questionIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      questionIds.map((id, index) =>
        this.prisma.quizQuestion.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  // ─── Option CRUD ─────────────────────────────────────────────

  async createOption(params: {
    questionId: string;
    optionText: string;
    isCorrect?: boolean | undefined;
  }): Promise<QuizQuestionOptionRecord> {
    const id = generateUuidV7();

    const maxSort = await this.prisma.quizQuestionOption.aggregate({
      where: { questionId: params.questionId },
      _max: { sortOrder: true },
    });

    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const option = await this.prisma.quizQuestionOption.create({
      data: {
        id,
        questionId: params.questionId,
        optionText: params.optionText,
        isCorrect: params.isCorrect ?? false,
        sortOrder,
      },
    });

    return this.mapOptionToRecord(option);
  }

  async updateOption(
    id: string,
    data: {
      optionText?: string | undefined;
      isCorrect?: boolean | undefined;
    },
  ): Promise<QuizQuestionOptionRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.optionText !== undefined) {
      updateData.optionText = data.optionText;
    }

    if (data.isCorrect !== undefined) {
      updateData.isCorrect = data.isCorrect;
    }

    const option = await this.prisma.quizQuestionOption.update({
      where: { id },
      data: updateData,
    });

    return this.mapOptionToRecord(option);
  }

  async deleteOption(id: string): Promise<void> {
    await this.prisma.quizQuestionOption.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async reorderOptions(optionIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      optionIds.map((id, index) =>
        this.prisma.quizQuestionOption.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async findOptionById(id: string): Promise<QuizQuestionOptionRecord | null> {
    const option = await this.prisma.quizQuestionOption.findFirst({
      where: { id, deletedAt: null },
    });

    if (!option) {
      return null;
    }

    return this.mapOptionToRecord(option);
  }

  // ─── Mappers ─────────────────────────────────────────────────

  private mapToRecord(quiz: {
    id: string;
    productId: string;
    sectionId?: string | null;
    title: string;
    description: string | null;
    passingPercentage: number;
    timeLimitSeconds: number | null;
    sortOrder: number;
    sectionName?: string | null;
    isPublished: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    questions?: Array<{
      id: string;
      quizId: string;
      questionText: string;
      questionType: QuestionType;
      points: number;
      sortOrder: number;
      hint: string | null;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
      options?: Array<{
        id: string;
        questionId: string;
        optionText: string;
        isCorrect: boolean;
        sortOrder: number;
        createdAt: Date;
      }>;
    }>;
    _count?: { questions: number };
  }): QuizRecord {
    return {
      id: quiz.id,
      product_id: quiz.productId,
      section_id: quiz.sectionId ?? null,
      title: quiz.title,
      description: quiz.description,
      passing_percentage: quiz.passingPercentage,
      time_limit_seconds: quiz.timeLimitSeconds,
      sort_order: quiz.sortOrder,
      section_name: quiz.sectionName ?? null,
      is_published: quiz.isPublished,
      metadata: (quiz.metadata as Record<string, unknown>) ?? {},
      created_at: quiz.createdAt,
      updated_at: quiz.updatedAt,
      ...(quiz.questions && {
        questions: quiz.questions.map((q) => this.mapQuestionToRecord(q)),
      }),
      ...(quiz._count && { question_count: quiz._count.questions }),
    };
  }

  private mapQuestionToRecord(question: {
    id: string;
    quizId: string;
    questionText: string;
    questionType: QuestionType;
    points: number;
    sortOrder: number;
    hint: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    options?: Array<{
      id: string;
      questionId: string;
      optionText: string;
      isCorrect: boolean;
      sortOrder: number;
      createdAt: Date;
    }>;
  }): QuizQuestionRecord {
    return {
      id: question.id,
      quiz_id: question.quizId,
      question_text: question.questionText,
      question_type: QUESTION_TYPE_MAP[question.questionType],
      points: question.points,
      sort_order: question.sortOrder,
      hint: question.hint,
      metadata: (question.metadata as Record<string, unknown>) ?? {},
      created_at: question.createdAt,
      updated_at: question.updatedAt,
      ...(question.options && {
        options: question.options.map((o) => this.mapOptionToRecord(o)),
      }),
    };
  }

  private mapOptionToRecord(option: {
    id: string;
    questionId: string;
    optionText: string;
    isCorrect: boolean;
    sortOrder: number;
    createdAt: Date;
  }): QuizQuestionOptionRecord {
    return {
      id: option.id,
      question_id: option.questionId,
      option_text: option.optionText,
      is_correct: option.isCorrect,
      sort_order: option.sortOrder,
      created_at: option.createdAt,
    };
  }
}

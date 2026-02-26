import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { Errors } from '../exceptions/auth.exception';

/**
 * Zod Validation Pipe
 * Replaces validate.middleware.ts from Express
 * Preserves exact validation behavior with Zod schemas
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.issues[0];

        throw Errors.validationError(firstError?.message ?? 'Validation failed');
      }

      throw error;
    }
  }
}

/**
 * Factory function to create validation pipe with schema
 */
export function ZodValidation(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

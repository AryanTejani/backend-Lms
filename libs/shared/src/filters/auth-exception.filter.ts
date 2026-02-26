import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, LoggerService as NestLoggerService } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthException, AuthErrorCode } from '../exceptions/auth.exception';

/**
 * Auth Exception Filter
 * Replaces error.middleware.ts from Express
 */
@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: NestLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log error data (but not sensitive info)
    const logData = {
      message: exception instanceof Error ? exception.message : 'Unknown error',
      path: request.path,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    // Handle AuthException
    if (exception instanceof AuthException) {
      if (exception.getStatus() >= 500) {
        if (this.logger) {
          this.logger.error(`Auth Error: ${JSON.stringify(logData)}`, exception.stack, 'AuthExceptionFilter');
        } else {
          console.error('Auth Error:', logData, exception.stack);
        }
      }

      response.status(exception.getStatus()).json(exception.toJSON());

      return;
    }

    // Handle standard HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (status >= 500) {
        if (this.logger) {
          this.logger.error(`HTTP Error: ${JSON.stringify(logData)}`, exception.stack, 'AuthExceptionFilter');
        } else {
          console.error('HTTP Error:', logData, exception.stack);
        }
      }

      // If response is already in our format, use it
      if (typeof exceptionResponse === 'object' && 'error' in (exceptionResponse as object)) {
        response.status(status).json(exceptionResponse);

        return;
      }

      response.status(status).json({
        error: {
          code: AuthErrorCode.INTERNAL_ERROR,
          message:
            typeof exceptionResponse === 'string' ? exceptionResponse : ((exceptionResponse as { message?: string }).message ?? 'An error occurred'),
        },
      });

      return;
    }

    // Handle unknown errors
    if (this.logger) {
      this.logger.error(
        `Unexpected Error: ${JSON.stringify(logData)}`,
        exception instanceof Error ? exception.stack : String(exception),
        'AuthExceptionFilter',
      );
    } else {
      console.error('Unexpected Error:', logData, exception instanceof Error ? exception.stack : exception);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: AuthErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  }
}

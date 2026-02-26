import { LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { mkdirSync } from 'fs';

export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly appName: string) {
    const logDir = process.env.LOG_DIR ?? '/var/www/app/tmp/traderlionApp';
    const transports: winston.transport[] = [];

    try {
      mkdirSync(logDir, { recursive: true });

      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: `${appName}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      );
    } catch {
      console.warn(`[LoggerService] Could not create log directory "${logDir}", file logging disabled`);
    }

    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const ctx = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

            return `${timestamp} ${level} ${ctx}${message}${metaStr}`;
          }),
        ),
      }),
    );

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      transports,
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message, details } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    error: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { status, error: STATUS_NAMES[status] ?? exception.name, message: payload };
      }

      const record = payload as Record<string, unknown>;
      const rawMessage = record.message;
      return {
        status,
        error: (record.error as string) ?? STATUS_NAMES[status] ?? exception.name,
        message: Array.isArray(rawMessage)
          ? (rawMessage[0] as string)
          : ((rawMessage as string) ?? exception.message),
        details: record.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          error: STATUS_NAMES[409],
          message: 'A record with these unique fields already exists',
        };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, error: STATUS_NAMES[404], message: 'Record not found' };
      }
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.CONFLICT,
          error: STATUS_NAMES[409],
          message: 'This record is referenced by other data and cannot be modified',
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: STATUS_NAMES[500],
      message: 'Something went wrong. Please try again later.',
    };
  }
}

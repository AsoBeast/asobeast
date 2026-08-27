import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiErrorEnvelope, InvalidStoreUrlError } from '@asobeast/shared';
import { EntitlementRequiredError } from '../auth/auth.errors';
import { OnDemandLimitError } from '../auth/on-demand.limiter';
import { WorkspaceSuspendedError } from '../auth/abuse/abuse.errors';
import {
  CredentialRateLimitError,
  RateLimitExceededError,
} from '../auth/rate-limit/rate-limit.errors';
import { QuotaExceededError } from '../auth/quota.errors';
import { UnknownPriceError } from '../billing/price-catalog';
import { ErrorTracking } from '../observability/error-tracking.service';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StoreRequestError,
} from '../store-providers/errors';

const SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

type ResolvedError = Pick<
  ApiErrorEnvelope,
  | 'statusCode'
  | 'error'
  | 'message'
  | 'quota'
  | 'entitlement'
  | 'rateLimit'
  | 'retryAfterSeconds'
>;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly tracking: ErrorTracking) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const resolved = this.resolve(exception);
    if (resolved.statusCode >= SERVER_ERROR_STATUS) {
      this.tracking.capture(exception, {
        transaction: `${request.method} ${request.url}`,
      });
    }
    const envelope: ApiErrorEnvelope = {
      ...resolved,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    if (resolved.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(resolved.retryAfterSeconds));
    }
    response.status(resolved.statusCode).json(envelope);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof InvalidStoreUrlError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.message,
      };
    }
    if (exception instanceof StoreNotSupportedError) {
      return {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        error: 'Not Implemented',
        message: exception.message,
      };
    }
    if (exception instanceof StoreAppNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: exception.message,
      };
    }
    if (exception instanceof StoreRequestError) {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message: exception.message,
      };
    }
    if (exception instanceof UnknownPriceError) {
      this.logger.error(exception.message);
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'That plan is not for sale on this instance',
      };
    }
    if (exception instanceof WorkspaceSuspendedError) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: exception.message,
      };
    }
    if (exception instanceof CredentialRateLimitError) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: exception.message,
        retryAfterSeconds: exception.retryAfterSeconds,
      };
    }
    if (exception instanceof RateLimitExceededError) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: exception.message,
        rateLimit: exception.detail,
        retryAfterSeconds: exception.detail.resetSeconds,
      };
    }
    if (exception instanceof OnDemandLimitError) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: exception.message,
        retryAfterSeconds: exception.retryAfterSeconds,
      };
    }
    if (exception instanceof QuotaExceededError) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: exception.message,
        quota: exception.detail,
      };
    }
    if (exception instanceof EntitlementRequiredError) {
      return {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: exception.message,
        entitlement: exception.detail,
      };
    }
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Resource not found',
      };
    }
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Resource already exists',
      };
    }
    if (exception instanceof HttpException) {
      return this.fromHttp(exception);
    }
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private fromHttp(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { statusCode, error: exception.name, message: body };
    }
    const record = body as Record<string, unknown>;
    const message = Array.isArray(record.message)
      ? record.message.join(', ')
      : typeof record.message === 'string'
        ? record.message
        : exception.message;
    const error =
      typeof record.error === 'string' ? record.error : exception.name;
    return { statusCode, error, message };
  }
}

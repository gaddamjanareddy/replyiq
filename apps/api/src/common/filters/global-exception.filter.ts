import {
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { Logger } from 'nestjs-pino';

/**
 * Default machine-readable codes applied when an exception does not carry an
 * explicit one. Keeps the public contract stable without requiring every
 * throw site to remember a code (see common/errors/error-codes.ts).
 */
function defaultCodeForStatus(status: number): string | undefined {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'AUTH_UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'AUTHZ_FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'RESOURCE_NOT_FOUND';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_FAILED';
    case HttpStatus.INTERNAL_SERVER_ERROR:
      return 'INTERNAL_ERROR';
    default:
      return undefined;
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        message = (exceptionResponse as { message: string | string[] }).message;
        code = (exceptionResponse as { code?: string }).code;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
      code ??= defaultCodeForStatus(status);
    } else {
      this.logger.error({ err: exception }, 'Unhandled exception');
      message = 'Internal server error';
      // Non-HttpException failures skip the branch above, so the code is set
      // here too - every 500 must carry INTERNAL_ERROR, not just the ones
      // thrown as HttpExceptions.
      code = defaultCodeForStatus(status);
    }

    response.status(status).send({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

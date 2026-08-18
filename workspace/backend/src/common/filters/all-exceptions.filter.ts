import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isPayloadTooLarge =
      exception instanceof PayloadTooLargeException ||
      (exception as { type?: string; status?: number; statusCode?: number })?.type ===
        'entity.too.large' ||
      (exception as { status?: number })?.status === 413 ||
      (exception as { statusCode?: number })?.statusCode === 413;

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isPayloadTooLarge
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object =
      exception instanceof HttpException
        ? exception.getResponse()
        : isPayloadTooLarge
          ? 'Upload is too large — keep files under 100 MB'
          : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof message === 'string' ? { message } : message),
    });
  }
}

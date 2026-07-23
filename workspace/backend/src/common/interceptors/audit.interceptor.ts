import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '@prisma/client';
import { AuthenticatedUser } from '../decorators';

const AUDIT_ACTION_KEY = 'auditAction';
const AUDIT_ENTITY_KEY = 'auditEntity';

export const Audit = (action: AuditAction, entityType?: string) =>
  (target: object, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    if (entityType) {
      Reflect.defineMetadata(AUDIT_ENTITY_KEY, entityType, descriptor.value);
    }
    return descriptor;
  };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<AuditAction>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    const entityType = this.reflector.get<string>(
      AUDIT_ENTITY_KEY,
      context.getHandler(),
    );

    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.auditService.log({
            companyId: user?.companyId,
            userId: user?.id,
            action,
            entityType: entityType ?? request.route?.path,
            entityId: data?.id ?? request.params?.id,
            newValue: data ? JSON.parse(JSON.stringify(data)) : undefined,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        } catch {
          // Audit failures should not break requests
        }
      }),
    );
  }
}

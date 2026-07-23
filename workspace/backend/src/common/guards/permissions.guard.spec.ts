import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  const mockContext = (user: unknown, handler = jest.fn()) =>
    ({
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows when no permissions metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ permissions: [] }))).toBe(true);
  });

  it('allows when user has required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['issues:create']);
    expect(
      guard.canActivate(mockContext({ permissions: ['issues:create', 'issues:read'] })),
    ).toBe(true);
  });

  it('denies when user lacks required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:access']);
    expect(() =>
      guard.canActivate(mockContext({ permissions: ['issues:read'] })),
    ).toThrow(ForbiddenException);
  });

  it('denies when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['issues:read']);
    expect(() => guard.canActivate(mockContext(null))).toThrow(ForbiddenException);
  });
});

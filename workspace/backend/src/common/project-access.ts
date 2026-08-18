import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from './decorators';

const PRIVILEGED_ROLES = new Set([
  'super_admin',
  'company_admin',
  'project_manager',
]);

/** Company admins / PMs can see all projects and edit any task. */
export function isPrivilegedProjectUser(user: AuthenticatedUser): boolean {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some((r) => PRIVILEGED_ROLES.has(String(r)));
}

export function isClientRole(user: AuthenticatedUser): boolean {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some((r) => String(r) === 'client');
}

export function assertCanChangeTaskStatus(
  user: AuthenticatedUser,
  assigneeId: string | null | undefined,
): void {
  if (isPrivilegedProjectUser(user)) return;
  if (assigneeId && assigneeId === user.id) return;
  throw new ForbiddenException(
    'You can only change status for tasks assigned to you',
  );
}

export function assertCanFullyEditIssue(
  user: AuthenticatedUser,
  assigneeId: string | null | undefined,
): void {
  if (isPrivilegedProjectUser(user)) return;
  throw new ForbiddenException(
    'Only admins can fully edit tasks. You may change status on tasks assigned to you.',
  );
}

/** Admins/PMs can delete any task; everyone else can delete only tasks they created. */
export function canDeleteIssue(
  user: AuthenticatedUser,
  reporterId?: string | null,
): boolean {
  if (isPrivilegedProjectUser(user)) return true;
  return Boolean(reporterId && reporterId === user.id);
}

export function assertCanDeleteIssue(
  user: AuthenticatedUser,
  reporterId?: string | null,
): void {
  if (canDeleteIssue(user, reporterId)) return;
  throw new ForbiddenException(
    'You can only delete tasks you created. Admins can delete any task.',
  );
}

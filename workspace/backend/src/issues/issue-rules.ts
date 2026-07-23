import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Lightweight pure helpers extracted for unit testing issue key generation
 * and status transition rules used by IssuesService.
 */
@Injectable()
export class IssueRules {
  buildKey(projectKey: string, number: number): string {
    return `${projectKey.toUpperCase()}-${number}`;
  }

  assertTransitionAllowed(
    current: string,
    next: string,
    allowed: Record<string, string[]>,
  ): void {
    const targets = allowed[current] ?? [];
    if (!targets.includes(next)) {
      throw new ForbiddenException(`Cannot transition from ${current} to ${next}`);
    }
  }

  assertProjectAccess(memberIds: string[], userId: string): void {
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('Not a project member');
    }
  }

  requireIssue<T>(issue: T | null): T {
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }
}

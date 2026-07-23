import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IssueRules } from './issue-rules';

describe('IssueRules', () => {
  const rules = new IssueRules();

  it('builds Jira-style issue keys', () => {
    expect(rules.buildKey('tf', 1)).toBe('TF-1');
    expect(rules.buildKey('ACME', 42)).toBe('ACME-42');
  });

  it('allows valid workflow transitions', () => {
    const allowed = { TODO: ['IN_PROGRESS'], IN_PROGRESS: ['DONE', 'TODO'] };
    expect(() => rules.assertTransitionAllowed('TODO', 'IN_PROGRESS', allowed)).not.toThrow();
  });

  it('blocks invalid workflow transitions', () => {
    const allowed = { TODO: ['IN_PROGRESS'] };
    expect(() => rules.assertTransitionAllowed('TODO', 'DONE', allowed)).toThrow(
      ForbiddenException,
    );
  });

  it('enforces project membership', () => {
    expect(() => rules.assertProjectAccess(['u1', 'u2'], 'u1')).not.toThrow();
    expect(() => rules.assertProjectAccess(['u1'], 'u3')).toThrow(ForbiddenException);
  });

  it('throws when issue is missing', () => {
    expect(() => rules.requireIssue(null)).toThrow(NotFoundException);
    expect(rules.requireIssue({ id: '1' })).toEqual({ id: '1' });
  });
});

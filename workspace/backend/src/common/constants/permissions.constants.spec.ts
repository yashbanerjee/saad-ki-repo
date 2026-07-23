import { SYSTEM_ROLES, PERMISSION_DEFINITIONS, ROLE_PERMISSIONS, ROLE_NAMES } from './permissions.constants';

describe('RBAC constants', () => {
  it('defines all eight system roles', () => {
    expect(SYSTEM_ROLES).toEqual([
      'super_admin',
      'company_admin',
      'project_manager',
      'team_lead',
      'developer',
      'qa',
      'client',
      'viewer',
    ]);
  });

  it('maps every system role to permissions and display names', () => {
    for (const role of SYSTEM_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      expect(ROLE_NAMES[role]).toBeTruthy();
    }
  });

  it('uses unique permission slugs', () => {
    const slugs = PERMISSION_DEFINITIONS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives company_admin full permission set', () => {
    expect(ROLE_PERMISSIONS.company_admin).toHaveLength(PERMISSION_DEFINITIONS.length);
  });

  it('keeps client permissions read-focused', () => {
    expect(ROLE_PERMISSIONS.client).toEqual(
      expect.arrayContaining(['projects:read', 'issues:read', 'documents:read', 'nda:read']),
    );
    expect(ROLE_PERMISSIONS.client).not.toContain('users:manage');
  });
});

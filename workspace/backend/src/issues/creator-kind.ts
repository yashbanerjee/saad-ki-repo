export type CreatorKind = 'client' | 'admin' | 'employee' | 'other';

export const CREATOR_KIND_LABEL: Record<CreatorKind, string> = {
  client: 'Client',
  admin: 'Admin',
  employee: 'Employee',
  other: 'Other',
};

export function creatorKindFromRoleSlugs(slugs: string[]): CreatorKind {
  const set = new Set(slugs.map((s) => String(s).toLowerCase()));
  if (set.has('client')) return 'client';
  if (set.has('super_admin') || set.has('company_admin')) return 'admin';
  if (
    set.has('project_manager') ||
    set.has('team_lead') ||
    set.has('developer') ||
    set.has('qa') ||
    set.has('viewer')
  ) {
    return 'employee';
  }
  return 'other';
}

export function readCreatorKind(metadata: unknown): CreatorKind | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).createdByKind;
  if (raw === 'client' || raw === 'admin' || raw === 'employee' || raw === 'other') {
    return raw;
  }
  return null;
}

export function withCreatorKind(
  existingMetadata: unknown,
  kind: CreatorKind,
): Record<string, unknown> {
  const base =
    existingMetadata &&
    typeof existingMetadata === 'object' &&
    !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  base.createdByKind = kind;
  return base;
}

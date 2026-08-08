import { IssueStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

export type BoardColumnDef = {
  id: string;
  title: string;
  order: number;
};

export const DEFAULT_BOARD_COLUMNS: BoardColumnDef[] = [
  { id: IssueStatus.TODO, title: 'Todo', order: 0 },
  { id: IssueStatus.IN_PROGRESS, title: 'In Progress', order: 1 },
  { id: IssueStatus.TESTING, title: 'Testing', order: 2 },
  { id: IssueStatus.DONE, title: 'Done', order: 3 },
];

const ENUM_STATUSES = new Set(Object.values(IssueStatus));

export function isEnumStatusId(id: string): id is IssueStatus {
  return ENUM_STATUSES.has(id as IssueStatus) && id !== IssueStatus.CUSTOM;
}

/** Map legacy / rich workflow statuses onto the default 4 columns */
export function mapLegacyStatusToDefaultColumn(status: string): IssueStatus {
  const s = String(status).toUpperCase();
  if (s === 'DONE' || s === 'CANCELLED') return IssueStatus.DONE;
  if (s === 'IN_PROGRESS' || s === 'BLOCKED') return IssueStatus.IN_PROGRESS;
  if (
    [
      'TESTING',
      'CODE_REVIEW',
      'READY_FOR_QA',
      'QA_FAILED',
      'READY_FOR_RELEASE',
    ].includes(s)
  ) {
    return IssueStatus.TESTING;
  }
  if (s === 'TODO') return IssueStatus.TODO;
  return IssueStatus.TODO;
}

export function parseBoardColumns(settings: unknown): BoardColumnDef[] {
  const raw =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).boardColumns
      : undefined;

  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c }));
  }

  const cols: BoardColumnDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id || '').trim();
    const title = String(obj.title || obj.name || '').trim();
    if (!id || !title) continue;
    cols.push({
      id,
      title: title.slice(0, 60),
      order: typeof obj.order === 'number' ? obj.order : cols.length,
    });
  }

  if (!cols.length) {
    return DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c }));
  }

  return cols.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
}

export function mergeSettingsWithColumns(
  settings: unknown,
  columns: BoardColumnDef[],
): Prisma.InputJsonValue {
  const base =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  base.boardColumns = columns.map((c, i) => ({
    id: c.id,
    title: c.title,
    order: i,
  }));
  return base as Prisma.InputJsonValue;
}

export function newColumnId(): string {
  return `col_${randomBytes(8).toString('hex')}`;
}

export function resolveIssueBoardColumnId(
  issue: { status: string; metadata?: unknown },
  columns: BoardColumnDef[],
): string {
  const ids = new Set(columns.map((c) => c.id));
  const meta =
    issue.metadata && typeof issue.metadata === 'object' && !Array.isArray(issue.metadata)
      ? (issue.metadata as Record<string, unknown>)
      : {};
  const metaCol = typeof meta.boardColumnId === 'string' ? meta.boardColumnId : null;

  if (metaCol && ids.has(metaCol)) return metaCol;
  if (ids.has(issue.status)) return issue.status;

  // Map enum statuses onto closest column id that still exists
  const mapped = mapLegacyStatusToDefaultColumn(issue.status);
  if (ids.has(mapped)) return mapped;

  // Prefer Todo / first open-ish column
  const todo = columns.find((c) => c.id === IssueStatus.TODO || /todo/i.test(c.title));
  return todo?.id ?? columns[0].id;
}

export function buildIssueUpdateForColumn(
  columnId: string,
  existingMetadata: unknown,
): {
  status: IssueStatus;
  metadata: Prisma.InputJsonValue;
} {
  const base =
    existingMetadata &&
    typeof existingMetadata === 'object' &&
    !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};

  if (isEnumStatusId(columnId)) {
    delete base.boardColumnId;
    return {
      status: columnId,
      metadata: base as Prisma.InputJsonValue,
    };
  }

  // Custom column → CUSTOM status + column id in metadata
  base.boardColumnId = columnId;
  return {
    status: IssueStatus.CUSTOM,
    metadata: base as Prisma.InputJsonValue,
  };
}

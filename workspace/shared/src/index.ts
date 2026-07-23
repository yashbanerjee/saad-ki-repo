/** Shared enums and DTOs used by backend & frontend */

export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  PROJECT_MANAGER = 'project_manager',
  TEAM_LEAD = 'team_lead',
  DEVELOPER = 'developer',
  QA = 'qa',
  CLIENT = 'client',
  VIEWER = 'viewer',
}

export enum IssueType {
  EPIC = 'EPIC',
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
  SUB_TASK = 'SUB_TASK',
  IMPROVEMENT = 'IMPROVEMENT',
  RESEARCH = 'RESEARCH',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  SUPPORT_TICKET = 'SUPPORT_TICKET',
  CUSTOM = 'CUSTOM',
}

export enum IssueStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  CODE_REVIEW = 'CODE_REVIEW',
  READY_FOR_QA = 'READY_FOR_QA',
  QA_FAILED = 'QA_FAILED',
  READY_FOR_RELEASE = 'READY_FOR_RELEASE',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED',
}

export enum IssuePriority {
  LOWEST = 'LOWEST',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  HIGHEST = 'HIGHEST',
  CRITICAL = 'CRITICAL',
}

export enum FieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  DROPDOWN = 'DROPDOWN',
  CHECKBOX = 'CHECKBOX',
  RADIO = 'RADIO',
  DATE = 'DATE',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  FILE_UPLOAD = 'FILE_UPLOAD',
  IMAGE_UPLOAD = 'IMAGE_UPLOAD',
  ADDRESS = 'ADDRESS',
  COUNTRY = 'COUNTRY',
  GST_NUMBER = 'GST_NUMBER',
  PAN_NUMBER = 'PAN_NUMBER',
  COMPANY_REG_NUMBER = 'COMPANY_REG_NUMBER',
  CUSTOM = 'CUSTOM',
  SECTION = 'SECTION',
}

export const BOARD_COLUMNS: { status: IssueStatus; label: string; color: string }[] = [
  { status: IssueStatus.TODO, label: 'To Do', color: '#94a3b8' },
  { status: IssueStatus.IN_PROGRESS, label: 'In Progress', color: '#3b82f6' },
  { status: IssueStatus.CODE_REVIEW, label: 'Code Review', color: '#8b5cf6' },
  { status: IssueStatus.READY_FOR_QA, label: 'Ready for QA', color: '#f59e0b' },
  { status: IssueStatus.DONE, label: 'Done', color: '#22c55e' },
];

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
  roles: string[];
  permissions: string[];
  avatar?: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string | null;
  roles: string[];
  permissions: string[];
}

export const PERMISSIONS = {
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_READ: 'projects:read',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  ISSUES_CREATE: 'issues:create',
  ISSUES_READ: 'issues:read',
  ISSUES_UPDATE: 'issues:update',
  ONBOARDING_MANAGE: 'onboarding:manage',
  NDA_MANAGE: 'nda:manage',
  NDA_SIGN: 'nda:sign',
  ADMIN_ACCESS: 'admin:access',
  DASHBOARD_READ: 'dashboard:read',
} as const;

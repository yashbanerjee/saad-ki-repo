export const SYSTEM_ROLES = [
  'super_admin',
  'company_admin',
  'project_manager',
  'team_lead',
  'developer',
  'qa',
  'client',
  'viewer',
] as const;

export const PERMISSION_DEFINITIONS = [
  { name: 'Manage Users', slug: 'users:manage', module: 'users' },
  { name: 'View Users', slug: 'users:read', module: 'users' },
  { name: 'Invite Users', slug: 'users:invite', module: 'users' },
  { name: 'Manage Roles', slug: 'roles:manage', module: 'roles' },
  { name: 'View Roles', slug: 'roles:read', module: 'roles' },
  { name: 'Manage Company', slug: 'company:manage', module: 'company' },
  { name: 'View Company', slug: 'company:read', module: 'company' },
  { name: 'Create Projects', slug: 'projects:create', module: 'projects' },
  { name: 'Manage Projects', slug: 'projects:manage', module: 'projects' },
  { name: 'View Projects', slug: 'projects:read', module: 'projects' },
  { name: 'Create Issues', slug: 'issues:create', module: 'issues' },
  { name: 'Manage Issues', slug: 'issues:manage', module: 'issues' },
  { name: 'View Issues', slug: 'issues:read', module: 'issues' },
  { name: 'Manage Sprints', slug: 'sprints:manage', module: 'sprints' },
  { name: 'View Sprints', slug: 'sprints:read', module: 'sprints' },
  { name: 'Manage Onboarding', slug: 'onboarding:manage', module: 'onboarding' },
  { name: 'View Onboarding', slug: 'onboarding:read', module: 'onboarding' },
  { name: 'Manage Documents', slug: 'documents:manage', module: 'documents' },
  { name: 'View Documents', slug: 'documents:read', module: 'documents' },
  { name: 'Manage NDA', slug: 'nda:manage', module: 'nda' },
  { name: 'View NDA', slug: 'nda:read', module: 'nda' },
  { name: 'Manage Clients', slug: 'clients:manage', module: 'clients' },
  { name: 'View Clients', slug: 'clients:read', module: 'clients' },
  { name: 'Manage Workflows', slug: 'workflows:manage', module: 'workflows' },
  { name: 'View Workflows', slug: 'workflows:read', module: 'workflows' },
  { name: 'Manage Teams', slug: 'teams:manage', module: 'teams' },
  { name: 'View Teams', slug: 'teams:read', module: 'teams' },
  { name: 'View Reports', slug: 'reports:read', module: 'reports' },
  { name: 'View Dashboard', slug: 'dashboard:read', module: 'dashboard' },
  { name: 'View Audit Logs', slug: 'audit:read', module: 'audit' },
  { name: 'Global Search', slug: 'search:read', module: 'search' },
] as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSION_DEFINITIONS.map((p) => p.slug),
  company_admin: PERMISSION_DEFINITIONS.map((p) => p.slug),
  project_manager: [
    'users:read', 'projects:create', 'projects:manage', 'projects:read',
    'issues:create', 'issues:manage', 'issues:read', 'sprints:manage', 'sprints:read',
    'clients:read', 'teams:read', 'workflows:read', 'dashboard:read', 'search:read',
    'documents:manage', 'documents:read', 'reports:read',
  ],
  team_lead: [
    'users:read', 'projects:read', 'issues:create', 'issues:manage', 'issues:read',
    'sprints:read', 'teams:read', 'dashboard:read', 'search:read', 'documents:read',
  ],
  developer: [
    'projects:read', 'issues:create', 'issues:manage', 'issues:read',
    'sprints:read', 'search:read', 'documents:read',
  ],
  qa: [
    'projects:read', 'issues:read', 'issues:manage', 'sprints:read',
    'search:read', 'documents:read',
  ],
  client: [
    'projects:read', 'issues:read', 'documents:read', 'nda:read',
  ],
  viewer: [
    'projects:read', 'issues:read', 'dashboard:read', 'search:read',
  ],
};

export const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  project_manager: 'Project Manager',
  team_lead: 'Team Lead',
  developer: 'Developer',
  qa: 'QA Engineer',
  client: 'Client',
  viewer: 'Viewer',
};

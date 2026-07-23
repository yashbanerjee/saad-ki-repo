/**
 * TaskFlow Enterprise – Database Seed
 * Mirrors backend RBAC constants and creates demo tenant data.
 */
import {
  PrismaClient,
  IssueType,
  IssuePriority,
  IssueStatus,
  ProjectStatus,
  SprintStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSION_DEFINITIONS = [
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
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
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
  client: ['projects:read', 'issues:read', 'documents:read', 'nda:read'],
  viewer: ['projects:read', 'issues:read', 'dashboard:read', 'search:read'],
};

const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  project_manager: 'Project Manager',
  team_lead: 'Team Lead',
  developer: 'Developer',
  qa: 'QA',
  client: 'Client',
  viewer: 'Viewer',
};

async function main() {
  console.log('Seeding TaskFlow Enterprise...\n');

  for (const p of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { name: p.name, module: p.module },
      create: { ...p, description: p.name },
    });
  }
  const allPermissions = await prisma.permission.findMany();
  console.log(`OK ${allPermissions.length} permissions`);

  const company = await prisma.company.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      email: 'admin@acme.demo',
      phone: '+1-555-0100',
      website: 'https://acme.demo',
      country: 'United States',
      status: 'ACTIVE',
      subscription: {
        create: {
          plan: 'enterprise',
          status: 'ACTIVE',
          seats: 50,
          storageGb: 100,
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  console.log(`OK Company: ${company.name}`);

  const roleMap: Record<string, string> = {};
  for (const [slug, permSlugs] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { companyId_slug: { companyId: company.id, slug } },
      update: {},
      create: {
        companyId: company.id,
        name: ROLE_NAMES[slug],
        slug,
        isSystem: true,
        description: `System role: ${ROLE_NAMES[slug]}`,
      },
    });
    roleMap[slug] = role.id;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const toAssign = allPermissions.filter((p) => permSlugs.includes(p.slug));
    await prisma.rolePermission.createMany({
      data: toAssign.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`OK ${Object.keys(roleMap).length} roles`);

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const usersData = [
    { email: 'admin@acme.demo', firstName: 'Sarah', lastName: 'Admin', role: 'company_admin' },
    { email: 'pm@acme.demo', firstName: 'Mike', lastName: 'Manager', role: 'project_manager' },
    { email: 'lead@acme.demo', firstName: 'Lisa', lastName: 'Lead', role: 'team_lead' },
    { email: 'dev@acme.demo', firstName: 'Dan', lastName: 'Developer', role: 'developer' },
    { email: 'qa@acme.demo', firstName: 'Quinn', lastName: 'Tester', role: 'qa' },
    { email: 'client@acme.demo', firstName: 'Chris', lastName: 'Client', role: 'client' },
  ];

  const userMap: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, status: 'ACTIVE', emailVerified: true },
      create: {
        companyId: company.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    userMap[u.role] = user.id;
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleMap[u.role] } });
  }
  console.log(`OK ${usersData.length} users (password: Password123!)`);

  let client = await prisma.client.findFirst({
    where: { companyId: company.id, email: 'client@acme.demo' },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: 'Chris Client',
        email: 'client@acme.demo',
        companyName: 'Client Industries',
        country: 'United States',
        status: 'active',
      },
    });
  }

  const dept = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Engineering' } },
    update: {},
    create: { companyId: company.id, name: 'Engineering', description: 'Product engineering' },
  });

  const team = await prisma.team.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Platform' } },
    update: {},
    create: {
      companyId: company.id,
      departmentId: dept.id,
      name: 'Platform',
      description: 'Core platform team',
    },
  });

  for (const role of ['developer', 'team_lead', 'qa']) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: userMap[role] } },
      update: {},
      create: {
        teamId: team.id,
        userId: userMap[role],
        role: role === 'team_lead' ? 'lead' : 'member',
      },
    });
  }

  let workflow = await prisma.workflow.findFirst({
    where: { companyId: company.id, isDefault: true },
    include: { statuses: true },
  });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: {
        companyId: company.id,
        name: 'Default Software Workflow',
        description: 'Standard Jira-style workflow',
        isDefault: true,
        statuses: {
          create: [
            { name: 'To Do', slug: 'todo', color: '#94a3b8', category: 'todo', order: 0, isInitial: true },
            { name: 'In Progress', slug: 'in_progress', color: '#3b82f6', category: 'in_progress', order: 1 },
            { name: 'Code Review', slug: 'code_review', color: '#8b5cf6', category: 'in_progress', order: 2 },
            { name: 'Ready for QA', slug: 'ready_for_qa', color: '#f59e0b', category: 'in_progress', order: 3 },
            { name: 'Done', slug: 'done', color: '#22c55e', category: 'done', order: 4, isFinal: true },
          ],
        },
      },
      include: { statuses: true },
    });
  }

  const project = await prisma.project.upsert({
    where: { companyId_key: { companyId: company.id, key: 'TF' } },
    update: {},
    create: {
      companyId: company.id,
      clientId: client.id,
      key: 'TF',
      name: 'TaskFlow Platform',
      description: 'Main TaskFlow product development',
      status: ProjectStatus.ACTIVE,
      workflowId: workflow.id,
      startDate: new Date(),
    },
  });

  for (const [role, userId] of Object.entries(userMap)) {
    if (role === 'client') continue;
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: {
        projectId: project.id,
        userId,
        role: role === 'project_manager' ? 'admin' : 'member',
      },
    });
  }

  let sprint = await prisma.sprint.findFirst({
    where: { projectId: project.id, name: 'Sprint 1' },
  });
  if (!sprint) {
    sprint = await prisma.sprint.create({
      data: {
        projectId: project.id,
        name: 'Sprint 1',
        goal: 'Deliver core auth and project modules',
        status: SprintStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const labels = await Promise.all(
    [
      { name: 'frontend', color: '#06b6d4' },
      { name: 'backend', color: '#10b981' },
      { name: 'urgent', color: '#ef4444' },
    ].map((l) =>
      prisma.label.upsert({
        where: { projectId_name: { projectId: project.id, name: l.name } },
        update: {},
        create: { projectId: project.id, ...l },
      }),
    ),
  );

  const existingIssues = await prisma.issue.count({ where: { projectId: project.id } });
  if (existingIssues === 0) {
    const issuesSeed = [
      { type: IssueType.EPIC, title: 'Authentication System', status: IssueStatus.IN_PROGRESS, priority: IssuePriority.HIGH, points: 13 },
      { type: IssueType.STORY, title: 'Implement JWT login flow', status: IssueStatus.IN_PROGRESS, priority: IssuePriority.HIGH, points: 5 },
      { type: IssueType.TASK, title: 'Add refresh token rotation', status: IssueStatus.TODO, priority: IssuePriority.MEDIUM, points: 3 },
      { type: IssueType.BUG, title: 'Login redirect loops on expired token', status: IssueStatus.TODO, priority: IssuePriority.HIGHEST, points: 2 },
      { type: IssueType.STORY, title: 'Kanban board drag and drop', status: IssueStatus.CODE_REVIEW, priority: IssuePriority.HIGH, points: 8 },
      { type: IssueType.TASK, title: 'Write API integration tests', status: IssueStatus.READY_FOR_QA, priority: IssuePriority.MEDIUM, points: 5 },
      { type: IssueType.FEATURE_REQUEST, title: 'AI sprint planning assistant', status: IssueStatus.TODO, priority: IssuePriority.LOW, points: 21 },
      { type: IssueType.BUG, title: 'Form builder conditional fields not saving', status: IssueStatus.IN_PROGRESS, priority: IssuePriority.HIGH, points: 3 },
    ];

    let number = 0;
    for (const issue of issuesSeed) {
      number += 1;
      await prisma.issue.create({
        data: {
          projectId: project.id,
          number,
          key: `TF-${number}`,
          type: issue.type,
          title: issue.title,
          description: `Seeded issue: ${issue.title}`,
          status: issue.status,
          priority: issue.priority,
          reporterId: userMap.project_manager,
          assigneeId: issue.type === IssueType.BUG ? userMap.qa : userMap.developer,
          sprintId: sprint.id,
          storyPoints: issue.points,
          stepsToReproduce: issue.type === IssueType.BUG ? '1. Open app\n2. Perform action\n3. Observe error' : undefined,
          expectedResult: issue.type === IssueType.BUG ? 'Expected correct behavior' : undefined,
          actualResult: issue.type === IssueType.BUG ? 'Unexpected error occurred' : undefined,
          labels: { create: [{ labelId: labels[issue.type === IssueType.BUG ? 2 : 1].id }] },
        },
      });
    }
    console.log(`OK Project TF with ${issuesSeed.length} issues & Sprint 1`);
  } else {
    console.log(`OK Project TF already has ${existingIssues} issues`);
  }

  let form = await prisma.onboardingForm.findFirst({
    where: { companyId: company.id, slug: 'client-onboarding' },
  });
  if (!form) {
    form = await prisma.onboardingForm.create({
      data: {
        companyId: company.id,
        createdById: userMap.company_admin,
        title: 'Client Onboarding',
        description: 'Standard client intake form',
        slug: 'client-onboarding',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        pages: {
          create: [
            {
              title: 'Company Details',
              order: 0,
              sections: { create: [{ title: 'Basic Information', order: 0 }] },
            },
            { title: 'Documents', order: 1 },
          ],
        },
      },
    });

    const pages = await prisma.formPage.findMany({
      where: { formId: form.id },
      include: { sections: true },
      orderBy: { order: 'asc' },
    });

    await prisma.formField.createMany({
      data: [
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'TEXT', label: 'Company Name', name: 'company_name', required: true, order: 0 },
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'EMAIL', label: 'Contact Email', name: 'email', required: true, order: 1 },
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'PHONE', label: 'Phone', name: 'phone', required: false, order: 2 },
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'GST_NUMBER', label: 'GST Number', name: 'gst', required: false, order: 3 },
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'PAN_NUMBER', label: 'PAN Number', name: 'pan', required: false, order: 4 },
        { formId: form.id, pageId: pages[0].id, sectionId: pages[0].sections[0]?.id, type: 'COUNTRY', label: 'Country', name: 'country', required: true, order: 5 },
        { formId: form.id, pageId: pages[1].id, type: 'FILE_UPLOAD', label: 'Company Registration', name: 'reg_doc', required: true, order: 0 },
        { formId: form.id, pageId: pages[1].id, type: 'IMAGE_UPLOAD', label: 'ID Proof', name: 'id_proof', required: true, order: 1 },
      ],
    });
  }
  console.log(`OK Onboarding form (token: ${form.secureToken})`);

  const ndaCount = await prisma.ndaTemplate.count({ where: { companyId: company.id } });
  if (ndaCount === 0) {
    await prisma.ndaTemplate.create({
      data: {
        companyId: company.id,
        title: 'Standard Mutual NDA',
        content: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement is entered into by Acme Corporation and the undersigned Client.

1. Confidential Information means all non-public information disclosed by either party.
2. The Receiving Party agrees to hold Confidential Information in strict confidence.
3. This Agreement remains in effect for three (3) years.

IN WITNESS WHEREOF, the parties have executed this Agreement.`,
        isActive: true,
      },
    });
  }
  console.log('OK NDA template');

  const emailCount = await prisma.emailTemplate.count({ where: { companyId: company.id } });
  if (emailCount === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          companyId: company.id,
          name: 'welcome',
          subject: 'Welcome to {{companyName}}',
          body: '<h1>Welcome {{firstName}}!</h1><p>Your TaskFlow account is ready.</p>',
          variables: ['companyName', 'firstName'],
        },
        {
          companyId: company.id,
          name: 'issue_assigned',
          subject: 'Issue {{issueKey}} assigned to you',
          body: '<p>Hi {{firstName}}, you have been assigned {{issueKey}}: {{issueTitle}}</p>',
          variables: ['firstName', 'issueKey', 'issueTitle'],
        },
      ],
    });
  }

  console.log('\nSeed complete!');
  console.log('\nDemo logins (password: Password123!):');
  console.log('  admin@acme.demo  – Company Admin');
  console.log('  pm@acme.demo     – Project Manager');
  console.log('  dev@acme.demo    – Developer');
  console.log('  qa@acme.demo     – QA');
  console.log('  client@acme.demo – Client');
  console.log(`\nPublic onboarding: /onboarding/public/${form.secureToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

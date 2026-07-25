/**
 * TaskFlow seed — Vedha production baseline (no Acme demo junk).
 * Super Admin: info@vedha.ae / S@ad1002
 */
import { PrismaClient } from '@prisma/client';
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

const SYSTEM_ROLES = [
  'super_admin',
  'company_admin',
  'project_manager',
  'team_lead',
  'developer',
  'qa',
  'client',
  'viewer',
] as const;

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

const SUPER_ADMIN_EMAIL = 'info@vedha.ae';
const SUPER_ADMIN_PASSWORD = 'S@ad1002';

async function main() {
  console.log('Seeding Vedha TaskFlow (clean baseline)...\n');

  for (const p of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { name: p.name, module: p.module },
      create: { ...p, description: p.name },
    });
  }
  const allPermissions = await prisma.permission.findMany();
  console.log(`OK ${allPermissions.length} permissions`);

  // Remove old Acme demo company + related data if present
  const acme = await prisma.company.findUnique({ where: { slug: 'acme-corp' } });
  if (acme) {
    await prisma.company.delete({ where: { id: acme.id } });
    console.log('OK removed demo company acme-corp');
  }

  // Clean demo users that are not Vedha admin
  const demoEmails = [
    'admin@acme.demo',
    'pm@acme.demo',
    'lead@acme.demo',
    'dev@acme.demo',
    'qa@acme.demo',
    'client@acme.demo',
  ];
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });

  const company = await prisma.company.upsert({
    where: { slug: 'vedha' },
    update: {
      name: 'Vedha',
      email: SUPER_ADMIN_EMAIL,
      website: 'https://vedha.ae',
      country: 'United Arab Emirates',
      city: 'Dubai',
      status: 'ACTIVE',
    },
    create: {
      name: 'Vedha',
      slug: 'vedha',
      email: SUPER_ADMIN_EMAIL,
      website: 'https://vedha.ae',
      country: 'United Arab Emirates',
      city: 'Dubai',
      status: 'ACTIVE',
      subscription: {
        create: {
          plan: 'enterprise',
          status: 'ACTIVE',
          seats: 100,
          storageGb: 500,
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  console.log(`OK Company: ${company.name}`);

  const roleMap: Record<string, string> = {};
  for (const slug of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_slug: { companyId: company.id, slug } },
      update: { name: ROLE_NAMES[slug], isSystem: true },
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
    // All system roles for Vedha admin org get full set on super_admin & company_admin;
    // others get empty until assigned — keep same as before for non-admin roles from constants
    const slugs =
      slug === 'super_admin' || slug === 'company_admin'
        ? allPermissions.map((p) => p.slug)
        : slug === 'viewer'
          ? ['projects:read', 'issues:read', 'dashboard:read', 'search:read']
          : slug === 'client'
            ? ['projects:read', 'issues:read', 'documents:read', 'nda:read']
            : slug === 'developer'
              ? ['projects:read', 'issues:create', 'issues:manage', 'issues:read', 'sprints:read', 'search:read', 'documents:read']
              : slug === 'qa'
                ? ['projects:read', 'issues:read', 'issues:manage', 'sprints:read', 'search:read', 'documents:read']
                : slug === 'team_lead'
                  ? [
                      'users:read',
                      'projects:read',
                      'issues:create',
                      'issues:manage',
                      'issues:read',
                      'sprints:read',
                      'teams:read',
                      'dashboard:read',
                      'search:read',
                      'documents:read',
                    ]
                  : [
                      'users:read',
                      'projects:create',
                      'projects:manage',
                      'projects:read',
                      'issues:create',
                      'issues:manage',
                      'issues:read',
                      'sprints:manage',
                      'sprints:read',
                      'clients:read',
                      'teams:read',
                      'workflows:read',
                      'dashboard:read',
                      'search:read',
                      'documents:manage',
                      'documents:read',
                      'reports:read',
                    ];

    const toAssign = allPermissions.filter((p) => slugs.includes(p.slug));
    await prisma.rolePermission.createMany({
      data: toAssign.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`OK ${Object.keys(roleMap).length} roles`);

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      passwordHash,
      firstName: 'Vedha',
      lastName: 'Admin',
      companyId: company.id,
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Vedha',
      lastName: 'Admin',
      companyId: company.id,
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: admin.id } });
  await prisma.userRole.create({
    data: { userId: admin.id, roleId: roleMap.super_admin },
  });
  // Also attach company_admin for company-scoped ops
  await prisma.userRole.create({
    data: { userId: admin.id, roleId: roleMap.company_admin },
  });

  console.log(`OK Super Admin: ${SUPER_ADMIN_EMAIL}`);
  console.log('\nSeed complete — no demo projects/issues/forms created.');
  console.log(`Login: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

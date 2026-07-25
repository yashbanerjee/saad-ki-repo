/**
 * Upsert Vedha Super Admin only (safe to run on production DB).
 * Email: info@vedha.ae  Password: S@ad1002
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const EMAIL = 'info@vedha.ae';
const PASSWORD = 'S@ad1002';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  let company = await prisma.company.findUnique({ where: { slug: 'vedha' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Vedha',
        slug: 'vedha',
        email: EMAIL,
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
  }

  // Ensure permissions exist (minimal)
  const perms = [
    { name: 'Manage Users', slug: 'users:manage', module: 'users' },
    { name: 'Manage Company', slug: 'company:manage', module: 'company' },
    { name: 'Manage Projects', slug: 'projects:manage', module: 'projects' },
    { name: 'View Dashboard', slug: 'dashboard:read', module: 'dashboard' },
    { name: 'Manage Onboarding', slug: 'onboarding:manage', module: 'onboarding' },
  ];
  for (const p of perms) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, description: p.name },
    });
  }

  let role = await prisma.role.findFirst({
    where: { companyId: company.id, slug: 'super_admin' },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        companyId: company.id,
        name: 'Super Admin',
        slug: 'super_admin',
        isSystem: true,
      },
    });
  }

  const allPerms = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: allPerms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
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
      email: EMAIL,
      passwordHash,
      firstName: 'Vedha',
      lastName: 'Admin',
      companyId: company.id,
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  // Remove Acme demo company if still present
  const acme = await prisma.company.findUnique({ where: { slug: 'acme-corp' } });
  if (acme) {
    await prisma.company.delete({ where: { id: acme.id } });
    console.log('Removed acme-corp demo company');
  }

  console.log('Super admin ready:');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Company:  ${company.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

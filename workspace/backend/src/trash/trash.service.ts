import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS,
} from '../common/constants/permissions.constants';
import { TRASH_LABELS, type TrashEntityType } from './trash.types';

export interface MoveToTrashInput {
  companyId: string;
  userId?: string | null;
  entityType: TrashEntityType;
  entityId: string;
  title: string;
  href?: string | null;
}

@Injectable()
export class TrashService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensurePermissions();
  }

  async moveToTrash(input: MoveToTrashInput) {
    const now = new Date();
    await this.markDeleted(input.entityType, input.entityId, now);
    if (input.entityType === 'project') {
      await this.hideProjectChildren(input.entityId, now);
    }

    const existing = await this.prisma.trashItem.findFirst({
      where: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        restoredAt: null,
        purgedAt: null,
      },
    });
    if (existing) {
      return this.prisma.trashItem.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          href: input.href ?? existing.href,
          deletedById: input.userId || existing.deletedById,
          deletedAt: now,
        },
      });
    }

    return this.prisma.trashItem.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        href: input.href ?? undefined,
        deletedById: input.userId || undefined,
        deletedAt: now,
      },
    });
  }

  async list(companyId: string, user: AuthenticatedUser) {
    const where: Prisma.TrashItemWhereInput = {
      companyId,
      restoredAt: null,
      purgedAt: null,
    };
    if (!this.canManageTrash(user)) {
      where.deletedById = user.id;
    }
    const items = await this.prisma.trashItem.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      take: 200,
      include: {
        deletedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return items.map((item) => ({
      ...item,
      typeLabel: TRASH_LABELS[(item.entityType as TrashEntityType)] || item.entityType,
    }));
  }

  async restore(id: string, companyId: string, user: AuthenticatedUser) {
    const item = await this.requireActiveItem(id, companyId, user);
    const type = item.entityType as TrashEntityType;
    await this.markRestored(type, item.entityId);
    if (type === 'project') {
      await this.restoreProjectChildren(item.entityId, companyId);
    }
    return this.prisma.trashItem.update({
      where: { id: item.id },
      data: { restoredAt: new Date() },
    });
  }

  async purge(id: string, companyId: string, user: AuthenticatedUser) {
    if (!this.canManageTrash(user)) {
      throw new ForbiddenException('Only admins can permanently delete items');
    }
    const item = await this.requireActiveItem(id, companyId, user);
    await this.hardDelete(item.entityType as TrashEntityType, item.entityId);
    return this.prisma.trashItem.update({
      where: { id: item.id },
      data: { purgedAt: new Date() },
    });
  }

  canManageTrash(user: AuthenticatedUser) {
    return (
      user.roles?.includes('super_admin') ||
      user.roles?.includes('company_admin') ||
      user.roles?.includes('project_manager') ||
      user.permissions?.includes('trash:manage') === true
    );
  }

  private async requireActiveItem(id: string, companyId: string, user: AuthenticatedUser) {
    const item = await this.prisma.trashItem.findFirst({
      where: { id, companyId, restoredAt: null, purgedAt: null },
    });
    if (!item) throw new NotFoundException('Trash item not found');
    if (!this.canManageTrash(user) && item.deletedById !== user.id) {
      throw new ForbiddenException('You can only restore items you deleted');
    }
    return item;
  }

  private delegate(type: TrashEntityType) {
    const map: Record<TrashEntityType, keyof PrismaService> = {
      project: 'project',
      issue: 'issue',
      document: 'document',
      client: 'client',
      invoice: 'invoice',
      lead: 'lead',
      deal: 'deal',
      contact: 'contact',
      organization: 'organization',
      milestone: 'milestone',
      client_task: 'clientTask',
      sprint: 'sprint',
      onboarding_form: 'onboardingForm',
      crm_task: 'crmTask',
      crm_note: 'crmNote',
      attachment: 'attachment',
      comment: 'comment',
    };
    return this.prisma[map[type]] as {
      update: (args: unknown) => Promise<unknown>;
      updateMany: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  private async markDeleted(type: TrashEntityType, entityId: string, deletedAt: Date) {
    await this.delegate(type).update({
      where: { id: entityId },
      data: { deletedAt },
    });
  }

  private async markRestored(type: TrashEntityType, entityId: string) {
    try {
      await this.delegate(type).update({
        where: { id: entityId },
        data: { deletedAt: null },
      });
    } catch {
      throw new NotFoundException('This item can no longer be restored');
    }
  }

  private async hideProjectChildren(projectId: string, deletedAt: Date) {
    await this.prisma.issue.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt },
    });
    await this.prisma.milestone.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt },
    });
    await this.prisma.clientTask.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt },
    });
    await this.prisma.sprint.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt },
    });
    await this.prisma.document.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt },
    });
  }

  private async restoreProjectChildren(projectId: string, companyId: string) {
    const blocked = await this.prisma.trashItem.findMany({
      where: {
        companyId,
        restoredAt: null,
        purgedAt: null,
        entityType: { in: ['issue', 'milestone', 'client_task', 'sprint', 'document'] },
      },
      select: { entityId: true },
    });
    const skipIds = blocked.map((row) => row.entityId);
    const notIndependentlyTrashed =
      skipIds.length > 0 ? { id: { notIn: skipIds } } : {};

    await this.prisma.issue.updateMany({
      where: { projectId, deletedAt: { not: null }, ...notIndependentlyTrashed },
      data: { deletedAt: null },
    });
    await this.prisma.milestone.updateMany({
      where: { projectId, deletedAt: { not: null }, ...notIndependentlyTrashed },
      data: { deletedAt: null },
    });
    await this.prisma.clientTask.updateMany({
      where: { projectId, deletedAt: { not: null }, ...notIndependentlyTrashed },
      data: { deletedAt: null },
    });
    await this.prisma.sprint.updateMany({
      where: { projectId, deletedAt: { not: null }, ...notIndependentlyTrashed },
      data: { deletedAt: null },
    });
    await this.prisma.document.updateMany({
      where: { projectId, deletedAt: { not: null }, ...notIndependentlyTrashed },
      data: { deletedAt: null },
    });
  }

  private async collectIds(
    find: (where: Record<string, unknown>) => Promise<Array<{ id: string }>>,
    projectId: string,
  ) {
    const [live, trashed] = await Promise.all([
      find({ projectId }),
      find({ projectId, deletedAt: { not: null } }),
    ]);
    return [...new Set([...live, ...trashed].map((row) => row.id))];
  }

  private async hardDelete(type: TrashEntityType, entityId: string) {
    if (type === 'project') {
      const childIds = (
        await Promise.all([
          this.collectIds(
            (where) =>
              this.prisma.issue.findMany({ where: where as never, select: { id: true } }),
            entityId,
          ),
          this.collectIds(
            (where) =>
              this.prisma.milestone.findMany({ where: where as never, select: { id: true } }),
            entityId,
          ),
          this.collectIds(
            (where) =>
              this.prisma.clientTask.findMany({ where: where as never, select: { id: true } }),
            entityId,
          ),
          this.collectIds(
            (where) =>
              this.prisma.sprint.findMany({ where: where as never, select: { id: true } }),
            entityId,
          ),
          this.collectIds(
            (where) =>
              this.prisma.document.findMany({ where: where as never, select: { id: true } }),
            entityId,
          ),
        ])
      ).flat();

      await this.prisma.$transaction(async (tx) => {
        await tx.issue.updateMany({ where: { projectId: entityId }, data: { parentId: null } });
        await tx.invoice.updateMany({
          where: { projectId: entityId },
          data: { projectId: null, milestoneId: null },
        });
        await tx.document.updateMany({ where: { projectId: entityId }, data: { projectId: null } });
        await tx.activityLog.updateMany({
          where: { projectId: entityId },
          data: { projectId: null },
        });
        await tx.project.delete({ where: { id: entityId } });
      });

      if (childIds.length > 0) {
        await this.prisma.trashItem.updateMany({
          where: {
            entityId: { in: childIds },
            restoredAt: null,
            purgedAt: null,
          },
          data: { purgedAt: new Date() },
        });
      }
      return;
    }
    try {
      await this.delegate(type).delete({ where: { id: entityId } });
    } catch {
      /* already gone */
    }
  }

  private async ensurePermissions() {
    for (const perm of PERMISSION_DEFINITIONS.filter((p) => p.module === 'trash')) {
      await this.prisma.permission.upsert({
        where: { slug: perm.slug },
        create: perm,
        update: { name: perm.name },
      });
    }
    const trashPerms = await this.prisma.permission.findMany({
      where: { slug: { in: ['trash:read', 'trash:manage'] } },
      select: { id: true, slug: true },
    });
    if (trashPerms.length === 0) return;
    const roles = await this.prisma.role.findMany({
      where: { slug: { in: Object.keys(ROLE_PERMISSIONS) } },
      select: { id: true, slug: true },
    });
    for (const role of roles) {
      const allowed = ROLE_PERMISSIONS[role.slug] || [];
      for (const perm of trashPerms) {
        if (!allowed.includes(perm.slug)) continue;
        await this.prisma.rolePermission.createMany({
          data: [{ roleId: role.id, permissionId: perm.id }],
          skipDuplicates: true,
        });
      }
    }
  }
}

export { TRASH_ENTITY_TYPES, TRASH_LABELS } from './trash.types';
export type { TrashEntityType } from './trash.types';

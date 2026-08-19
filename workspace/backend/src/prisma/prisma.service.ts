import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set<string>([
  'Project',
  'Issue',
  'Document',
  'Client',
  'Invoice',
  'Lead',
  'Deal',
  'Contact',
  'Organization',
  'Milestone',
  'ClientTask',
  'Sprint',
  'OnboardingForm',
  'CrmTask',
  'CrmNote',
  'Attachment',
  'Comment',
]);

function applyActiveFilter(args: { where?: Record<string, unknown> | null }) {
  const where = { ...(args.where ?? {}) };
  if (where.deletedAt === undefined) {
    where.deletedAt = null;
  }
  args.where = where;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const extended = this.$extends({
      name: 'softDelete',
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) applyActiveFilter(args);
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) applyActiveFilter(args);
            return query(args);
          },
          async findFirstOrThrow({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) applyActiveFilter(args);
            return query(args);
          },
          async count({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) applyActiveFilter(args);
            return query(args);
          },
          async aggregate({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) applyActiveFilter(args);
            return query(args);
          },
        },
      },
    });
    Object.assign(extended, {
      onModuleInit: async () => {
        await extended.$connect();
      },
      onModuleDestroy: async () => {
        await extended.$disconnect();
      },
    });
    return extended as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

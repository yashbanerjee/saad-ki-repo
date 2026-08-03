import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientType,
  CrmActivityType,
  DealStatus,
  LeadSource,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import {
  ConvertLeadDto,
  ConvertLeadToDealDto,
  CreateLeadActivityDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  MoveLeadsToBoardDto,
  UpdateLeadDto,
} from './dto/lead.dto';

const SOURCE_ALIASES: Record<string, LeadSource> = {
  website: LeadSource.WEBSITE,
  referral: LeadSource.REFERRAL,
  cold_call: LeadSource.COLD_CALL,
  coldcall: LeadSource.COLD_CALL,
  email: LeadSource.EMAIL,
  social: LeadSource.SOCIAL,
  event: LeadSource.EVENT,
  partner: LeadSource.PARTNER,
  other: LeadSource.OTHER,
};

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: ListLeadsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.LeadWhereInput = {
      companyId,
      archived: query.includeArchived ? undefined : false,
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.onBoard !== undefined ? { onBoard: query.onBoard } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { organizationName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          convertedClient: { select: { id: true, name: true, type: true } },
          _count: {
            select: {
              activities: true,
              deals: true,
              crmNotes: true,
              crmTasks: true,
              emails: true,
            },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, companyId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true, mobile: true },
        },
        convertedClient: true,
        deals: { orderBy: { createdAt: 'desc' } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        crmNotes: { orderBy: { createdAt: 'desc' }, take: 30 },
        crmTasks: {
          orderBy: { dueDate: 'asc' },
          take: 30,
          include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: {
          select: {
            activities: true,
            crmNotes: true,
            crmTasks: true,
            emails: true,
            callLogs: true,
            whatsappMessages: true,
            attachments: true,
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(companyId: string, userId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        companyId,
        title: dto.title,
        name: dto.name,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        website: dto.website,
        jobTitle: dto.jobTitle,
        organizationName: dto.organizationName,
        organizationId: dto.organizationId,
        contactId: dto.contactId,
        type: dto.type ?? ClientType.COMPANY,
        status: dto.status ?? LeadStatus.NEW,
        source: dto.source,
        ownerId: dto.ownerId ?? userId,
        estimatedValue: dto.estimatedValue,
        notes: dto.notes,
        onBoard: dto.onBoard ?? false,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async moveToBoard(companyId: string, dto: MoveLeadsToBoardDto) {
    const result = await this.prisma.lead.updateMany({
      where: { companyId, id: { in: dto.ids }, archived: false },
      data: { onBoard: true },
    });
    return { updated: result.count };
  }

  async removeFromBoard(companyId: string, dto: MoveLeadsToBoardDto) {
    const result = await this.prisma.lead.updateMany({
      where: { companyId, id: { in: dto.ids }, archived: false },
      data: { onBoard: false },
    });
    return { updated: result.count };
  }

  async importFromFile(
    companyId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Spreadsheet has no sheets');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
    }) as Record<string, unknown>[];

    if (!rows.length) {
      throw new BadRequestException('Spreadsheet has no data rows');
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      try {
        const mapped = this.mapImportRow(rows[i]);
        if (!mapped) {
          skipped += 1;
          errors.push({ row: rowNum, message: 'Missing title and name' });
          continue;
        }
        await this.prisma.lead.create({
          data: {
            companyId,
            ownerId: userId,
            title: mapped.title,
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            organizationName: mapped.organizationName,
            source: mapped.source,
            estimatedValue: mapped.estimatedValue,
            notes: mapped.notes,
            status: LeadStatus.NEW,
            type: ClientType.COMPANY,
            onBoard: false,
          },
        });
        created += 1;
      } catch (err) {
        skipped += 1;
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : 'Failed to import row',
        });
      }
    }

    return { created, skipped, errors: errors.slice(0, 50) };
  }

  private mapImportRow(row: Record<string, unknown>) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const k = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
      normalized[k] = String(value ?? '').trim();
    }

    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (normalized[k]) return normalized[k];
      }
      return '';
    };

    const title = pick('title', 'lead', 'lead_title', 'subject');
    const name = pick('name', 'contact', 'contact_name', 'full_name');
    if (!title && !name) return null;

    const sourceRaw = pick('source').toLowerCase().replace(/[\s-]+/g, '_');
    const source = SOURCE_ALIASES[sourceRaw] ?? LeadSource.OTHER;

    const valueRaw = pick('estimatedvalue', 'estimated_value', 'value', 'amount');
    let estimatedValue: number | undefined;
    if (valueRaw) {
      const n = Number(String(valueRaw).replace(/[,$]/g, ''));
      if (!Number.isNaN(n) && n >= 0) estimatedValue = n;
    }

    const email = pick('email', 'email_address') || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid email: ${email}`);
    }

    return {
      title: title || name,
      name: name || title,
      email,
      phone: pick('phone', 'telephone', 'mobile') || undefined,
      organizationName: pick('organization', 'company', 'organization_name', 'company_name') || undefined,
      source,
      estimatedValue,
      notes: pick('notes', 'note', 'comments') || undefined,
    };
  }

  async update(id: string, companyId: string, userId: string, dto: UpdateLeadDto) {
    const existing = await this.findOne(id, companyId);
    const statusChanged = dto.status && dto.status !== existing.status;

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.organizationName !== undefined ? { organizationName: dto.organizationName } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        ...(dto.estimatedValue !== undefined ? { estimatedValue: dto.estimatedValue } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
        ...(dto.onBoard !== undefined ? { onBoard: dto.onBoard } : {}),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        convertedClient: { select: { id: true, name: true, type: true } },
      },
    });

    if (statusChanged) {
      await this.prisma.crmActivity.create({
        data: {
          companyId,
          leadId: id,
          createdById: userId,
          type: CrmActivityType.STATUS_CHANGE,
          body: `Status changed from ${existing.status} to ${dto.status}`,
        },
      });
    }

    return lead;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.lead.update({ where: { id }, data: { archived: true } });
    return { message: 'Lead archived' };
  }

  async addActivity(
    id: string,
    companyId: string,
    userId: string,
    dto: CreateLeadActivityDto,
  ) {
    await this.findOne(id, companyId);
    return this.prisma.crmActivity.create({
      data: {
        companyId,
        leadId: id,
        createdById: userId,
        type: dto.type,
        body: dto.body,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async convert(id: string, companyId: string, userId: string, dto: ConvertLeadDto) {
    const lead = await this.findOne(id, companyId);

    if (lead.convertedClientId || lead.status === LeadStatus.WON) {
      throw new BadRequestException('Lead is already converted');
    }
    if (lead.status === LeadStatus.LOST) {
      throw new BadRequestException('Cannot convert a lost lead');
    }

    const type = dto.type ?? lead.type;
    const email = lead.email?.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException('Lead email is required to convert to a client');
    }

    let client = await this.prisma.client.findFirst({
      where: { companyId, email: { equals: email, mode: 'insensitive' } },
    });

    if (client && !dto.attachExisting) {
      throw new ConflictException(
        `A client with email ${email} already exists. Pass attachExisting=true to link it, or use a different email on the lead.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let organizationId = lead.organizationId;

      if (type === ClientType.COMPANY && lead.organizationName && !organizationId) {
        const org = await tx.organization.create({
          data: {
            companyId,
            name: lead.organizationName,
            email,
            phone: lead.phone ?? undefined,
          },
        });
        organizationId = org.id;
      }

      if (!client) {
        const firstName =
          type === ClientType.INDIVIDUAL ? lead.name.split(/\s+/)[0] : undefined;
        const lastName =
          type === ClientType.INDIVIDUAL
            ? lead.name.split(/\s+/).slice(1).join(' ') || undefined
            : undefined;

        client = await tx.client.create({
          data: {
            companyId,
            organizationId: organizationId ?? undefined,
            type,
            name:
              type === ClientType.COMPANY
                ? lead.organizationName || lead.name
                : lead.name,
            firstName,
            lastName,
            email,
            phone: lead.phone ?? undefined,
            companyName:
              type === ClientType.COMPANY
                ? lead.organizationName || lead.name
                : undefined,
          },
        });
      }

      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.WON,
          convertedClientId: client!.id,
          convertedAt: new Date(),
          organizationId: organizationId ?? lead.organizationId,
          type,
        },
        include: {
          convertedClient: true,
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.crmActivity.create({
        data: {
          companyId,
          leadId: id,
          clientId: client!.id,
          createdById: userId,
          type: CrmActivityType.STATUS_CHANGE,
          body: `Converted to ${type === ClientType.COMPANY ? 'company' : 'individual'} client ${client!.name}`,
        },
      });

      let deal = null;
      if (dto.createDeal) {
        deal = await tx.deal.create({
          data: {
            companyId,
            leadId: id,
            clientId: client!.id,
            organizationId: organizationId ?? undefined,
            ownerId: lead.ownerId ?? userId,
            title: dto.dealTitle || `${lead.title} — Deal`,
            amount: dto.dealAmount ?? lead.estimatedValue ?? undefined,
            status: DealStatus.OPEN,
            expectedCloseDate: dto.expectedCloseDate
              ? new Date(dto.expectedCloseDate)
              : undefined,
          },
        });
      }

      return { lead: updatedLead, client, deal };
    });

    return result;
  }

  async convertToDeal(
    id: string,
    companyId: string,
    userId: string,
    dto: ConvertLeadToDealDto,
  ) {
    const lead = await this.findOne(id, companyId);
    if (lead.status === LeadStatus.LOST) {
      throw new BadRequestException('Cannot convert a lost lead to a deal');
    }

    let clientId = lead.convertedClientId ?? undefined;
    if (dto.createClient && !clientId) {
      const converted = await this.convert(id, companyId, userId, {
        createDeal: false,
        attachExisting: true,
      });
      clientId = converted.client?.id;
    }

    const deal = await this.prisma.deal.create({
      data: {
        companyId,
        leadId: id,
        clientId,
        organizationId: lead.organizationId ?? undefined,
        contactId: lead.contactId ?? undefined,
        ownerId: lead.ownerId ?? userId,
        title: dto.title || lead.title,
        amount: dto.amount ?? lead.estimatedValue ?? undefined,
        status: DealStatus.OPEN,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        website: lead.website ?? undefined,
      },
      include: {
        lead: { select: { id: true, title: true } },
        client: { select: { id: true, name: true } },
      },
    });

    await this.prisma.lead.update({
      where: { id },
      data: { status: LeadStatus.WON, convertedAt: lead.convertedAt ?? new Date() },
    });

    await this.prisma.crmActivity.create({
      data: {
        companyId,
        leadId: id,
        dealId: deal.id,
        createdById: userId,
        type: CrmActivityType.STATUS_CHANGE,
        body: `Converted lead to deal ${deal.title}`,
      },
    });

    return { leadId: id, deal };
  }

  async statusCounts(companyId: string) {
    const groups = await this.prisma.lead.groupBy({
      by: ['status'],
      where: { companyId, archived: false },
      _count: true,
    });
    const byStatus = Object.fromEntries(
      Object.values(LeadStatus).map((s) => [s, 0]),
    ) as Record<LeadStatus, number>;
    for (const g of groups) {
      byStatus[g.status] = g._count;
    }
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const converted = byStatus.WON;
    return {
      byStatus,
      total,
      converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
    };
  }
}

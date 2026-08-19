import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateCrmNoteDto, ListCrmNotesQueryDto, UpdateCrmNoteDto } from './dto/crm-note.dto';
import { TrashService } from '../trash/trash.service';

@Injectable()
export class CrmNotesService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
  ) {}

  async findAll(companyId: string, query: ListCrmNotesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.CrmNoteWhereInput = {
      companyId,
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.crmNote.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          lead: { select: { id: true, title: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      this.prisma.crmNote.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const note = await this.prisma.crmNote.findFirst({ where: { id, companyId } });
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async create(companyId: string, userId: string, dto: CreateCrmNoteDto) {
    const note = await this.prisma.crmNote.create({
      data: {
        companyId,
        title: dto.title,
        body: dto.body,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        organizationId: dto.organizationId,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (dto.leadId || dto.dealId || dto.contactId) {
      await this.prisma.crmActivity.create({
        data: {
          companyId,
          leadId: dto.leadId,
          dealId: dto.dealId,
          contactId: dto.contactId,
          createdById: userId,
          type: CrmActivityType.NOTE,
          body: dto.title ? `${dto.title}: ${dto.body}` : dto.body,
        },
      });
    }

    return note;
  }

  async update(id: string, companyId: string, dto: UpdateCrmNoteDto) {
    await this.findOne(id, companyId);
    return this.prisma.crmNote.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string, userId?: string) {
    const note = await this.findOne(id, companyId);
    await this.trash.moveToTrash({
      companyId,
      userId,
      entityType: 'crm_note',
      entityId: id,
      title: note.title || note.body?.slice(0, 80) || 'Note',
      href: '/crm/notes',
    });
    return { message: 'Moved to trash' };
  }
}

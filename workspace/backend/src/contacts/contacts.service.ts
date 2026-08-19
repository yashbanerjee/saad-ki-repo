import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateContactDto, ListContactsQueryDto, UpdateContactDto } from './dto/contact.dto';
import { TrashService } from '../trash/trash.service';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
  ) {}

  async findAll(companyId: string, query: ListContactsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.ContactWhereInput = {
      companyId,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { mobile: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy: { firstName: 'asc' },
        include: {
          organization: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { leads: true, deals: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, companyId },
      include: {
        organization: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        leads: { take: 20, orderBy: { updatedAt: 'desc' } },
        deals: { take: 20, orderBy: { updatedAt: 'desc' } },
        activities: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(companyId: string, userId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        jobTitle: dto.jobTitle,
        organizationId: dto.organizationId,
        ownerId: dto.ownerId ?? userId,
        notes: dto.notes,
      },
      include: { organization: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, companyId: string, dto: UpdateContactDto) {
    await this.findOne(id, companyId);
    return this.prisma.contact.update({
      where: { id },
      data: dto,
      include: { organization: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, companyId: string, userId?: string) {
    const contact = await this.findOne(id, companyId);
    const title =
      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact';
    await this.trash.moveToTrash({
      companyId,
      userId,
      entityType: 'contact',
      entityId: id,
      title,
      href: `/contacts/${id}`,
    });
    return { message: 'Moved to trash' };
  }
}

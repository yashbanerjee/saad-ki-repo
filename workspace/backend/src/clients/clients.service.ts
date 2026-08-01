import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignOnboardingFormDto,
  CreateClientDto,
  CreateClientOnboardingFormDto,
  ListClientsQueryDto,
  UpdateClientDto,
} from './dto/client.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.ClientWhereInput = {
      companyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take,
        include: {
          organization: { select: { id: true, name: true } },
          convertedFromLead: { select: { id: true, title: true } },
          _count: {
            select: { projects: true, deals: true, formAssignments: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        organization: true,
        convertedFromLead: true,
        projects: true,
        deals: { orderBy: { createdAt: 'desc' }, take: 20 },
        formAssignments: {
          orderBy: { createdAt: 'desc' },
          include: {
            form: {
              select: {
                id: true,
                title: true,
                status: true,
                secureToken: true,
                publishedAt: true,
              },
            },
          },
        },
        _count: { select: { documents: true, formSubmissions: true, deals: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async listOnboardingForms(clientId: string, companyId: string) {
    await this.findOne(clientId, companyId);
    return this.prisma.clientOnboardingAssignment.findMany({
      where: { clientId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        form: {
          select: {
            id: true,
            title: true,
            status: true,
            secureToken: true,
            publishedAt: true,
            description: true,
            clientId: true,
          },
        },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async assignOnboardingForm(
    clientId: string,
    companyId: string,
    userId: string,
    dto: AssignOnboardingFormDto,
  ) {
    await this.findOne(clientId, companyId);
    const form = await this.prisma.onboardingForm.findFirst({
      where: { id: dto.formId, companyId, status: { not: 'ARCHIVED' } },
    });
    if (!form) throw new NotFoundException('Onboarding form not found');

    try {
      return await this.prisma.clientOnboardingAssignment.create({
        data: {
          companyId,
          clientId,
          formId: dto.formId,
          assignedById: userId,
          notes: dto.notes,
        },
        include: {
          form: {
            select: {
              id: true,
              title: true,
              status: true,
              secureToken: true,
              publishedAt: true,
            },
          },
        },
      });
    } catch {
      throw new ConflictException('This form is already assigned to the client');
    }
  }

  async createOnboardingFormForClient(
    clientId: string,
    companyId: string,
    userId: string,
    dto: CreateClientOnboardingFormDto,
  ) {
    const client = await this.findOne(clientId, companyId);
    const base = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const slug = `${base || 'client-form'}-${randomBytes(3).toString('hex')}`;

    const form = await this.prisma.onboardingForm.create({
      data: {
        companyId,
        createdById: userId,
        clientId,
        title: dto.title || `${client.name} onboarding`,
        description: dto.description,
        slug,
        status: dto.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: dto.publish ? new Date() : undefined,
      },
    });

    const assignment = await this.prisma.clientOnboardingAssignment.create({
      data: {
        companyId,
        clientId,
        formId: form.id,
        assignedById: userId,
        notes: 'Created specifically for this client',
      },
      include: {
        form: {
          select: {
            id: true,
            title: true,
            status: true,
            secureToken: true,
            publishedAt: true,
          },
        },
      },
    });

    return assignment;
  }

  async unassignOnboardingForm(
    clientId: string,
    companyId: string,
    assignmentId: string,
  ) {
    const assignment = await this.prisma.clientOnboardingAssignment.findFirst({
      where: { id: assignmentId, clientId, companyId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.clientOnboardingAssignment.delete({ where: { id: assignmentId } });
    return { message: 'Form unassigned from client' };
  }

  async create(companyId: string, userId: string, dto: CreateClientDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.client.findFirst({
      where: { companyId, email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`A client with email ${email} already exists`);
    }

    const type = dto.type ?? ClientType.COMPANY;
    let name = dto.name;
    if (type === ClientType.INDIVIDUAL && !name && (dto.firstName || dto.lastName)) {
      name = [dto.firstName, dto.lastName].filter(Boolean).join(' ');
    }

    const { assignFormId, createFormTitle, ...clientFields } = dto;

    const client = await this.prisma.client.create({
      data: {
        companyId,
        type,
        name,
        email,
        firstName: clientFields.firstName,
        lastName: clientFields.lastName,
        phone: clientFields.phone,
        companyName:
          clientFields.companyName ?? (type === ClientType.COMPANY ? name : undefined),
        website: clientFields.website,
        organizationId: clientFields.organizationId,
        address: clientFields.address,
        city: clientFields.city,
        country: clientFields.country,
      },
    });

    if (assignFormId) {
      await this.assignOnboardingForm(client.id, companyId, userId, { formId: assignFormId });
    } else if (createFormTitle) {
      await this.createOnboardingFormForClient(client.id, companyId, userId, {
        title: createFormTitle,
        publish: true,
      });
    }

    return this.findOne(client.id, companyId);
  }

  async update(id: string, companyId: string, dto: UpdateClientDto) {
    await this.findOne(id, companyId);
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const clash = await this.prisma.client.findFirst({
        where: {
          companyId,
          email: { equals: email, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException(`A client with email ${email} already exists`);
      }
    }
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.client.update({ where: { id }, data: { status: 'inactive' } });
    return { message: 'Client deactivated' };
  }
}

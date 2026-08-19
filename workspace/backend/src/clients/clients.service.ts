import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignOnboardingFormDto,
  CreateClientActivityDto,
  CreateClientDto,
  CreateClientLoginDto,
  CreateClientOnboardingFormDto,
  ListClientsQueryDto,
  SignSetupNdaDto,
  UpdateClientDto,
  UpdateClientSetupDto,
} from './dto/client.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import {
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from '../common/constants/permissions.constants';
import { renderNdaPlaceholders } from '../nda/nda-placeholders';
import { TrashService } from '../trash/trash.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
  ) {}

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
          formAssignments: {
            select: { status: true },
          },
          ndaSignatures: {
            where: { status: 'SIGNED' },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    const mapped = data.map(({ formAssignments, ndaSignatures, ...c }) => {
      const formsTotal = formAssignments.length;
      const formsDone = formAssignments.filter((a) => a.status === 'COMPLETED').length;
      const accountDone = !!c.userId;
      const ndaDone = !!c.ndaSignedAt || ndaSignatures.length > 0;
      const formsComplete = formsTotal === 0 || formsDone === formsTotal;
      const setupComplete =
        accountDone && formsComplete && (!c.requireNda || ndaDone);
      return {
        ...c,
        setupProgress: {
          accountDone,
          formsDone,
          formsTotal,
          formsComplete,
          ndaDone,
          requireNda: c.requireNda,
          setupComplete,
        },
      };
    });

    return paginatedResponse(mapped, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        organization: true,
        convertedFromLead: { select: { id: true, title: true } },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, status: true },
        },
        projects: {
          orderBy: { createdAt: 'desc' },
          include: {
            milestones: {
              where: { deletedAt: null },
              orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
            },
            clientTasks: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: 'asc' }],
              include: {
                milestone: { select: { id: true, name: true } },
              },
            },
            _count: { select: { issues: true, milestones: true } },
          },
        },
        deals: { orderBy: { createdAt: 'desc' }, take: 20 },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            project: { select: { id: true, name: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
            folder: { select: { id: true, name: true } },
          },
        },
        crmActivities: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
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
        ndaSignatures: {
          where: { status: 'SIGNED' },
          take: 5,
          orderBy: { signedAt: 'desc' },
        },
        _count: {
          select: {
            documents: true,
            formSubmissions: true,
            deals: true,
            projects: true,
            invoices: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const formsTotal = client.formAssignments.length;
    const formsDone = client.formAssignments.filter((a) => a.status === 'COMPLETED').length;
    const accountDone = !!client.userId;
    const ndaDone = !!client.ndaSignedAt || client.ndaSignatures.length > 0;
    const formsComplete = formsTotal === 0 || formsDone === formsTotal;
    const setupComplete = accountDone && formsComplete && (!client.requireNda || ndaDone);

    return {
      ...client,
      setupProgress: {
        accountDone,
        formsDone,
        formsTotal,
        formsComplete,
        ndaDone,
        requireNda: client.requireNda,
        setupComplete,
      },
    };
  }

  async addActivity(
    id: string,
    companyId: string,
    userId: string,
    dto: CreateClientActivityDto,
  ) {
    await this.findOne(id, companyId);
    return this.prisma.crmActivity.create({
      data: {
        companyId,
        clientId: id,
        createdById: userId,
        type: dto.type,
        body: dto.body,
        metadata: {
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.dueDate ? { dueDate: dto.dueDate } : {}),
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
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

  async remove(id: string, companyId: string, userId?: string) {
    const client = await this.findOne(id, companyId);
    await this.trash.moveToTrash({
      companyId,
      userId,
      entityType: 'client',
      entityId: id,
      title: client.name,
      href: `/clients/${id}`,
    });
    return { message: 'Moved to trash' };
  }

  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }

  /** Staff creates a login for a CRM client (email and/or mobile) */
  async createLogin(id: string, companyId: string, dto: CreateClientLoginDto) {
    const client = await this.findOne(id, companyId);
    if (client.userId) {
      throw new ConflictException('This client already has a login account');
    }

    const emailRaw = (dto.email || client.email || '').trim().toLowerCase();
    const phoneRaw = (dto.phone || client.phone || '').trim();
    const isPlaceholderEmail = emailRaw.endsWith('@client.taskflow.local');
    const realEmail = emailRaw && !isPlaceholderEmail ? emailRaw : '';
    const phone = phoneRaw ? this.normalizePhone(phoneRaw) : undefined;

    if (!realEmail && !phone) {
      throw new BadRequestException(
        'Client needs an email or mobile number before creating a login',
      );
    }

    const email =
      realEmail ||
      (phone ? `m.${phone.replace(/\D/g, '')}@client.taskflow.local` : emailRaw);

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('A user with this email already exists');
    }
    if (phone && (await this.prisma.user.findUnique({ where: { phone } }))) {
      throw new ConflictException('A user with this mobile number already exists');
    }

    let clientRole = await this.prisma.role.findFirst({
      where: { companyId, slug: 'client' },
    });
    if (!clientRole) {
      clientRole = await this.prisma.role.create({
        data: {
          companyId,
          name: ROLE_NAMES.client || 'Client',
          slug: 'client',
          isSystem: true,
        },
      });
      const perms = await this.prisma.permission.findMany({
        where: { slug: { in: ROLE_PERMISSIONS.client } },
      });
      if (perms.length) {
        await this.prisma.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: clientRole!.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    }

    const tempPassword = dto.password || `Vedha@${randomBytes(3).toString('hex')}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const firstName = client.firstName || client.name.split(' ')[0] || 'Client';
    const lastName =
      client.lastName || client.name.split(' ').slice(1).join(' ') || 'User';

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email,
        phone: phone || undefined,
        passwordHash,
        firstName,
        lastName,
        status: 'ACTIVE',
        emailVerified: !!realEmail,
        emailVerifiedAt: realEmail ? new Date() : undefined,
        roles: { create: { roleId: clientRole.id } },
      },
    });

    await this.prisma.client.update({
      where: { id },
      data: {
        userId: user.id,
        accountSetupAt: new Date(),
        ...(realEmail ? { email: realEmail } : {}),
        ...(phone ? { phone } : {}),
      },
    });

    return {
      userId: user.id,
      email: realEmail || null,
      phone: phone || null,
      loginWith: realEmail || phone,
      temporaryPassword: dto.password ? undefined : tempPassword,
      message: dto.password
        ? 'Client login created'
        : 'Client login created — share the temporary password securely',
    };
  }

  async enableSetup(id: string, companyId: string) {
    await this.findOne(id, companyId);
    const client = await this.prisma.client.findFirst({ where: { id, companyId } });
    const token = client?.setupToken || randomBytes(24).toString('hex');
    return this.prisma.client.update({
      where: { id },
      data: { setupEnabled: true, setupToken: token },
      select: {
        id: true,
        name: true,
        setupToken: true,
        setupEnabled: true,
        requireNda: true,
        ndaTemplateId: true,
      },
    });
  }

  async updateSetup(id: string, companyId: string, dto: UpdateClientSetupDto) {
    await this.findOne(id, companyId);
    if (dto.ndaTemplateId) {
      const tpl = await this.prisma.ndaTemplate.findFirst({
        where: { id: dto.ndaTemplateId, companyId, isActive: true },
      });
      if (!tpl) throw new BadRequestException('NDA template not found');
    }
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.requireNda !== undefined ? { requireNda: dto.requireNda } : {}),
        ...(dto.ndaTemplateId !== undefined
          ? { ndaTemplateId: dto.ndaTemplateId || null }
          : {}),
      },
      select: {
        id: true,
        name: true,
        setupToken: true,
        setupEnabled: true,
        requireNda: true,
        ndaTemplateId: true,
      },
    });
  }

  async getSetupByToken(token: string) {
    const client = await this.prisma.client.findFirst({
      where: { setupToken: token, setupEnabled: true },
      include: {
        company: { select: { name: true } },
        ndaTemplate: {
          select: { id: true, title: true, content: true, version: true },
        },
        formAssignments: {
          orderBy: { createdAt: 'asc' },
          include: {
            form: {
              select: {
                id: true,
                title: true,
                status: true,
                secureToken: true,
                description: true,
              },
            },
          },
        },
        ndaSignatures: {
          where: { status: 'SIGNED' },
          take: 1,
          select: { id: true, signedAt: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Setup link not found or disabled');

    // Auto-pick latest active NDA template if requireNda but none set
    let ndaTemplate = client.ndaTemplate;
    if (client.requireNda && !ndaTemplate) {
      ndaTemplate = await this.prisma.ndaTemplate.findFirst({
        where: { companyId: client.companyId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, content: true, version: true },
      });
    }

    const renderedNda = ndaTemplate
      ? {
          ...ndaTemplate,
          content: renderNdaPlaceholders(ndaTemplate.content, {
            companyName: client.company.name,
            clientName: client.name,
          }),
        }
      : null;

    const forms = client.formAssignments
      .filter((a) => a.form.status === 'PUBLISHED' || a.status === 'COMPLETED')
      .map((a) => ({
        assignmentId: a.id,
        formId: a.form.id,
        title: a.form.title,
        description: a.form.description,
        status: a.status,
        secureToken: a.form.secureToken,
        completed: a.status === 'COMPLETED',
      }));

    const accountDone = !!client.userId;
    const formsComplete =
      forms.length === 0 || forms.every((f) => f.completed);
    const ndaDone = !!client.ndaSignedAt || client.ndaSignatures.length > 0;
    const setupComplete =
      accountDone && formsComplete && (!client.requireNda || ndaDone);

    let currentStep: 'account' | 'forms' | 'nda' | 'done' = 'account';
    if (!accountDone) currentStep = 'account';
    else if (!formsComplete) currentStep = 'forms';
    else if (client.requireNda && !ndaDone) currentStep = 'nda';
    else currentStep = 'done';

    return {
      clientId: client.id,
      clientName: client.name,
      companyName: client.company.name,
      emailHint: client.email?.endsWith('@client.taskflow.local')
        ? null
        : client.email,
      phoneHint: client.phone,
      accountDone,
      forms,
      formsComplete,
      requireNda: client.requireNda,
      ndaDone,
      ndaTemplate: client.requireNda ? renderedNda : null,
      setupComplete,
      currentStep,
    };
  }

  async signSetupNda(
    token: string,
    userId: string,
    dto: SignSetupNdaDto,
    ip?: string,
    userAgent?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { setupToken: token, setupEnabled: true },
      include: {
        ndaTemplate: true,
        ndaSignatures: { where: { status: 'SIGNED' }, take: 1 },
      },
    });
    if (!client) throw new NotFoundException('Setup link not found or disabled');
    if (!client.requireNda) {
      throw new BadRequestException('NDA is not required for this client');
    }
    if (client.userId !== userId) {
      throw new BadRequestException('Sign in with the account created for this invite');
    }
    if (client.ndaSignedAt || client.ndaSignatures.length) {
      return { message: 'NDA already signed', alreadySigned: true };
    }

    let templateId = client.ndaTemplateId;
    if (!templateId) {
      const tpl = await this.prisma.ndaTemplate.findFirst({
        where: { companyId: client.companyId, isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!tpl) {
        throw new BadRequestException(
          'No NDA template is available — ask your agency to create one',
        );
      }
      templateId = tpl.id;
    }

    const signature = await this.prisma.digitalSignature.create({
      data: {
        ndaTemplateId: templateId,
        clientId: client.id,
        userId,
        status: 'SIGNED',
        signatureType: dto.signatureType,
        signatureData: dto.signatureData,
        signedAt: new Date(),
        ipAddress: ip,
        userAgent,
      },
    });

    await this.prisma.client.update({
      where: { id: client.id },
      data: { ndaSignedAt: new Date(), ndaTemplateId: templateId },
    });

    return { message: 'NDA signed', signatureId: signature.id };
  }
}

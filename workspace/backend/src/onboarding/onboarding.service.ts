import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { FieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFormDto,
  UpdateFormDto,
  CreateFormPageDto,
  CreateFormFieldDto,
  SaveFormFieldsDto,
  SubmitFormDto,
} from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  private slugify(text: string): string {
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return `${base || 'form'}-${randomBytes(3).toString('hex')}`;
  }

  async findAll(companyId: string) {
    return this.prisma.onboardingForm.findMany({
      where: { companyId, status: { not: 'ARCHIVED' } },
      include: { _count: { select: { submissions: true, fields: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const form = await this.prisma.onboardingForm.findFirst({
      where: { id, companyId },
      include: {
        pages: {
          include: { fields: true, sections: { include: { fields: true } } },
          orderBy: { order: 'asc' },
        },
        fields: { orderBy: { order: 'asc' } },
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async findByToken(secureToken: string) {
    const form = await this.prisma.onboardingForm.findFirst({
      where: { secureToken, status: 'PUBLISHED' },
      include: {
        pages: {
          include: { fields: true, sections: { include: { fields: true } } },
          orderBy: { order: 'asc' },
        },
        fields: { orderBy: { order: 'asc' } },
      },
    });
    if (!form) throw new NotFoundException('Form not found or not published');
    return form;
  }

  /**
   * Public form payload. When clientId is present and the client has no login yet,
   * returns clientGate so the frontend can redirect to the setup journey first.
   */
  async getPublicForm(secureToken: string, clientId?: string) {
    const form = await this.findByToken(secureToken);
    if (!clientId) return form;

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: form.companyId },
      select: {
        id: true,
        userId: true,
        setupToken: true,
        setupEnabled: true,
      },
    });
    if (!client) return { ...form, clientGate: null };

    if (client.userId) {
      return {
        ...form,
        clientGate: {
          accountDone: true,
          requiresAccount: false,
          setupToken: client.setupToken,
        },
      };
    }

    let setupToken = client.setupToken;
    if (!client.setupEnabled || !setupToken) {
      setupToken = setupToken || randomBytes(24).toString('hex');
      await this.prisma.client.update({
        where: { id: client.id },
        data: { setupEnabled: true, setupToken },
      });
    }

    return {
      ...form,
      clientGate: {
        accountDone: false,
        requiresAccount: true,
        setupToken,
      },
    };
  }

  async create(companyId: string, createdById: string, dto: CreateFormDto) {
    const slug = dto.slug?.trim() || this.slugify(dto.title);
    return this.prisma.onboardingForm.create({
      data: {
        companyId,
        createdById,
        title: dto.title,
        slug,
        description: dto.description,
      },
      include: {
        fields: true,
        _count: { select: { submissions: true, fields: true } },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateFormDto) {
    await this.findOne(id, companyId);
    return this.prisma.onboardingForm.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        settings: dto.settings as object | undefined,
      },
      include: {
        fields: { orderBy: { order: 'asc' } },
        _count: { select: { submissions: true, fields: true } },
      },
    });
  }

  async saveFields(id: string, companyId: string, dto: SaveFormFieldsDto) {
    await this.findOne(id, companyId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.title || dto.description !== undefined) {
        await tx.onboardingForm.update({
          where: { id },
          data: {
            ...(dto.title ? { title: dto.title } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
        });
      }

      await tx.formField.deleteMany({ where: { formId: id } });

      for (const [index, field] of dto.fields.entries()) {
        const type = this.normalizeFieldType(field.type);
        await tx.formField.create({
          data: {
            formId: id,
            type,
            label: field.label,
            name: field.name || `field_${index + 1}`,
            required: field.required ?? false,
            order: field.order ?? index,
            placeholder: field.placeholder,
            options: (field.options ?? []) as object,
            settings: (field.settings ?? {}) as object,
          },
        });
      }

      if (dto.publish) {
        await tx.onboardingForm.update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      }
    });

    return this.findOne(id, companyId);
  }

  private normalizeFieldType(type: string | FieldType): FieldType {
    const upper = String(type).toUpperCase().replace(/-/g, '_');
    if ((Object.values(FieldType) as string[]).includes(upper)) {
      return upper as FieldType;
    }
    const map: Record<string, FieldType> = {
      TEXT: FieldType.TEXT,
      TEXTAREA: FieldType.TEXTAREA,
      DROPDOWN: FieldType.DROPDOWN,
      CHECKBOX: FieldType.CHECKBOX,
      DATE: FieldType.DATE,
      EMAIL: FieldType.EMAIL,
      PHONE: FieldType.PHONE,
      NUMBER: FieldType.CUSTOM,
      IMAGE: FieldType.IMAGE_UPLOAD,
      IMAGE_UPLOAD: FieldType.IMAGE_UPLOAD,
      FILE: FieldType.FILE_UPLOAD,
      FILE_UPLOAD: FieldType.FILE_UPLOAD,
    };
    return map[upper] ?? FieldType.TEXT;
  }

  async publish(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.onboardingForm.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: {
        fields: { orderBy: { order: 'asc' } },
        _count: { select: { submissions: true, fields: true } },
      },
    });
  }

  async unpublish(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.onboardingForm.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
  }

  async addPage(formId: string, companyId: string, dto: CreateFormPageDto) {
    await this.findOne(formId, companyId);
    return this.prisma.formPage.create({
      data: { formId, title: dto.title, order: dto.order ?? 0 },
    });
  }

  async addField(formId: string, companyId: string, dto: CreateFormFieldDto) {
    await this.findOne(formId, companyId);
    return this.prisma.formField.create({
      data: {
        formId,
        pageId: dto.pageId,
        sectionId: dto.sectionId,
        type: this.normalizeFieldType(dto.type),
        label: dto.label,
        name: dto.name,
        required: dto.required ?? false,
        order: dto.order ?? 0,
        options: (dto.options ?? []) as object,
        placeholder: dto.placeholder,
        settings: (dto.settings ?? {}) as object,
      },
    });
  }

  async submitByToken(secureToken: string, dto: SubmitFormDto, ip?: string, userAgent?: string) {
    const form = await this.findByToken(secureToken);

    let clientId: string | undefined = dto.clientId?.trim() || undefined;
    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, companyId: form.companyId },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException('Invalid client for this form');
      }
    }

    const payload = (dto.data && typeof dto.data === 'object' ? dto.data : {}) as object;

    try {
      const submission = await this.prisma.formSubmission.create({
        data: {
          formId: form.id,
          clientId,
          status: 'SUBMITTED',
          data: payload,
          ipAddress: ip,
          userAgent,
          submittedAt: new Date(),
        },
      });

      if (clientId) {
        await this.prisma.clientOnboardingAssignment.updateMany({
          where: {
            formId: form.id,
            clientId,
            status: 'PENDING',
          },
          data: { status: 'COMPLETED' },
        });
      }

      return submission;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new BadRequestException('Invalid client reference');
        }
      }
      throw err;
    }
  }

  async getSubmissions(formId: string, companyId: string) {
    await this.findOne(formId, companyId);
    return this.prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.onboardingForm.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return { message: 'Form archived' };
  }
}

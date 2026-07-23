import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFormDto,
  UpdateFormDto,
  CreateFormPageDto,
  CreateFormFieldDto,
  SubmitFormDto,
} from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.onboardingForm.findMany({
      where: { companyId },
      include: { _count: { select: { submissions: true, fields: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const form = await this.prisma.onboardingForm.findFirst({
      where: { id, companyId },
      include: {
        pages: { include: { fields: true, sections: { include: { fields: true } } }, orderBy: { order: 'asc' } },
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
        pages: { include: { fields: true, sections: { include: { fields: true } } }, orderBy: { order: 'asc' } },
        fields: { orderBy: { order: 'asc' } },
      },
    });
    if (!form) throw new NotFoundException('Form not found or not published');
    return form;
  }

  async create(companyId: string, createdById: string, dto: CreateFormDto) {
    return this.prisma.onboardingForm.create({
      data: {
        companyId,
        createdById,
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
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
    });
  }

  async publish(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.onboardingForm.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
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
        type: dto.type,
        label: dto.label,
        name: dto.name,
        required: dto.required ?? false,
        order: dto.order ?? 0,
        options: (dto.options ?? []) as object,
        placeholder: dto.placeholder,
      },
    });
  }

  async submitByToken(secureToken: string, dto: SubmitFormDto, ip?: string, userAgent?: string) {
    const form = await this.findByToken(secureToken);
    return this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        clientId: dto.clientId,
        status: 'SUBMITTED',
        data: dto.data as object,
        ipAddress: ip,
        userAgent,
        submittedAt: new Date(),
      },
    });
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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AssignNdaDto,
  CreateNdaTemplateDto,
  PreviewNdaDto,
  SignNdaDto,
  RejectNdaDto,
  UpdateNdaTemplateDto,
} from './dto/nda.dto';
import { AuditAction } from '@prisma/client';
import { randomBytes } from 'crypto';
import { DEFAULT_NDA_CONTENT, renderNdaPlaceholders } from './nda-placeholders';

export { renderNdaPlaceholders, DEFAULT_NDA_CONTENT } from './nda-placeholders';

@Injectable()
export class NdaService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findTemplates(companyId: string) {
    const templates = await this.prisma.ndaTemplate.findMany({
      where: { companyId },
      include: {
        _count: { select: { signatures: true, setupClients: true } },
        setupClients: {
          select: { id: true, name: true },
          take: 5,
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return templates.map((t) => ({
      id: t.id,
      title: t.title,
      name: t.title,
      content: t.content,
      version: String(t.version),
      status: t.isActive ? 'active' : 'inactive',
      isActive: t.isActive,
      signed: t._count.signatures,
      assignedClients: t._count.setupClients,
      clients: t.setupClients,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async createTemplate(companyId: string, dto: CreateNdaTemplateDto) {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId },
      });
      if (!client) throw new BadRequestException('Client not found');
    }

    const template = await this.prisma.ndaTemplate.create({
      data: {
        companyId,
        title: dto.title.trim(),
        content: dto.content?.trim() || DEFAULT_NDA_CONTENT,
      },
    });

    if (dto.clientId) {
      await this.assignToClient(companyId, {
        clientId: dto.clientId,
        templateId: template.id,
      });
    }

    return template;
  }

  async updateTemplate(id: string, companyId: string, dto: UpdateNdaTemplateDto) {
    await this.findTemplate(id, companyId);
    return this.prisma.ndaTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        version: { increment: 1 },
      },
    });
  }

  async findTemplate(id: string, companyId: string) {
    const template = await this.prisma.ndaTemplate.findFirst({
      where: { id, companyId },
    });
    if (!template) throw new NotFoundException('NDA template not found');
    return template;
  }

  async preview(id: string, companyId: string, dto: PreviewNdaDto) {
    const template = await this.findTemplate(id, companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    let clientName = 'Client';
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId },
        select: { name: true },
      });
      if (client) clientName = client.name;
    }

    const content = dto.content ?? template.content;
    return {
      id: template.id,
      title: template.title,
      content: renderNdaPlaceholders(content, {
        companyName: company?.name,
        clientName,
      }),
      companyName: company?.name,
      clientName,
    };
  }

  async assignToClient(companyId: string, dto: AssignNdaDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) throw new NotFoundException('Client not found');

    let templateId = dto.templateId;

    if (dto.customContent?.trim()) {
      const created = await this.prisma.ndaTemplate.create({
        data: {
          companyId,
          title:
            dto.customTitle?.trim() ||
            `NDA — ${client.name}`,
          content: dto.customContent.trim(),
        },
      });
      templateId = created.id;
    }

    if (!templateId) {
      throw new BadRequestException('Select a template or provide custom NDA content');
    }

    const template = await this.prisma.ndaTemplate.findFirst({
      where: { id: templateId, companyId, isActive: true },
    });
    if (!template) throw new BadRequestException('NDA template not found');

    const setupToken = client.setupToken || randomBytes(24).toString('hex');

    const updated = await this.prisma.client.update({
      where: { id: client.id },
      data: {
        requireNda: true,
        ndaTemplateId: template.id,
        setupEnabled: true,
        setupToken,
        // Reset signature if re-assigning a new template
        ndaSignedAt: null,
      },
      select: {
        id: true,
        name: true,
        requireNda: true,
        ndaTemplateId: true,
        setupToken: true,
        setupEnabled: true,
      },
    });

    return {
      ...updated,
      template: { id: template.id, title: template.title },
      message: 'NDA assigned to client',
    };
  }

  async listSigned(companyId: string) {
    return this.prisma.digitalSignature.findMany({
      where: {
        status: 'SIGNED',
        ndaTemplate: { companyId },
      },
      include: {
        ndaTemplate: { select: { id: true, title: true, version: true } },
        client: { select: { id: true, name: true, email: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { signedAt: 'desc' },
    });
  }

  async sign(
    templateId: string,
    companyId: string,
    userId: string,
    dto: SignNdaDto,
    ip?: string,
    userAgent?: string,
  ) {
    await this.findTemplate(templateId, companyId);

    const signature = await this.prisma.digitalSignature.create({
      data: {
        ndaTemplateId: templateId,
        clientId: dto.clientId,
        userId,
        status: 'SIGNED',
        signatureType: dto.signatureType,
        signatureData: dto.signatureData,
        signedAt: new Date(),
        ipAddress: ip,
        userAgent,
      },
    });

    if (dto.clientId) {
      await this.prisma.client.updateMany({
        where: { id: dto.clientId, companyId },
        data: { ndaSignedAt: new Date(), ndaTemplateId: templateId },
      });
    }

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.DIGITAL_SIGNATURE,
      entityType: 'DigitalSignature',
      entityId: signature.id,
      ipAddress: ip,
      userAgent,
    });

    return signature;
  }

  async reject(
    signatureId: string,
    companyId: string,
    userId: string,
    dto: RejectNdaDto,
  ) {
    const signature = await this.prisma.digitalSignature.findFirst({
      where: { id: signatureId, ndaTemplate: { companyId } },
    });
    if (!signature) throw new NotFoundException('Signature not found');
    if (signature.status === 'SIGNED') {
      throw new BadRequestException('Cannot reject a signed NDA');
    }

    return this.prisma.digitalSignature.update({
      where: { id: signatureId },
      data: {
        status: 'REJECTED',
        rejectReason: dto.reason,
        rejectedAt: new Date(),
      },
    });
  }

  async getSignatures(templateId: string, companyId: string) {
    await this.findTemplate(templateId, companyId);
    return this.prisma.digitalSignature.findMany({
      where: { ndaTemplateId: templateId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

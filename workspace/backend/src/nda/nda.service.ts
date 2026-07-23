import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateNdaTemplateDto, SignNdaDto, RejectNdaDto } from './dto/nda.dto';
import { AuditAction } from '@prisma/client';

@Injectable()
export class NdaService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findTemplates(companyId: string) {
    return this.prisma.ndaTemplate.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(companyId: string, dto: CreateNdaTemplateDto) {
    return this.prisma.ndaTemplate.create({
      data: { companyId, title: dto.title, content: dto.content },
    });
  }

  async findTemplate(id: string, companyId: string) {
    const template = await this.prisma.ndaTemplate.findFirst({
      where: { id, companyId },
    });
    if (!template) throw new NotFoundException('NDA template not found');
    return template;
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

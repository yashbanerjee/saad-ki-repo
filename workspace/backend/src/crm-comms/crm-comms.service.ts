import { Injectable } from '@nestjs/common';
import {
  CrmActivityType,
  CrmCallStatus,
  CrmCommDirection,
  CrmMessageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import {
  CreateCrmAttachmentDto,
  CreateCrmCallLogDto,
  CreateCrmEmailDto,
  CreateCrmWhatsAppDto,
  ListCommsQueryDto,
} from './dto/crm-comms.dto';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class CrmCommsService {
  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
  ) {}

  private refWhere(query: ListCommsQueryDto): Prisma.CrmEmailWhereInput {
    return {
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
    };
  }

  async listEmails(companyId: string, query: ListCommsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where = { companyId, ...this.refWhere(query) };
    const [data, total] = await Promise.all([
      this.prisma.crmEmail.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.crmEmail.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async createEmail(companyId: string, userId: string, dto: CreateCrmEmailDto) {
    let status: CrmMessageStatus = CrmMessageStatus.LOGGED;
    let messageId: string | undefined;

    if (dto.send) {
      const result = await this.integrations.sendEmail({
        to: dto.toAddress,
        subject: dto.subject,
        body: dto.body,
      });
      if (result.sent) {
        status = CrmMessageStatus.SENT;
        messageId = result.messageId;
      }
    }

    const email = await this.prisma.crmEmail.create({
      data: {
        companyId,
        subject: dto.subject,
        body: dto.body,
        toAddress: dto.toAddress,
        fromAddress: dto.fromAddress,
        direction: dto.direction ?? CrmCommDirection.OUTBOUND,
        status,
        messageId,
        sentAt: status === CrmMessageStatus.SENT ? new Date() : undefined,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
      },
    });

    await this.prisma.crmActivity.create({
      data: {
        companyId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
        type: CrmActivityType.EMAIL,
        body: `Email: ${dto.subject}`,
      },
    });

    return email;
  }

  async listCalls(companyId: string, query: ListCommsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where = {
      companyId,
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.crmCallLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.crmCallLog.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async createCall(companyId: string, userId: string, dto: CreateCrmCallLogDto) {
    let status = dto.status ?? CrmCallStatus.LOGGED;
    let provider = 'manual';
    let externalId: string | undefined;

    if (dto.dial && dto.toNumber) {
      const result = await this.integrations.placeCall({
        to: dto.toNumber,
        from: dto.fromNumber,
      });
      if (result.placed) {
        status = CrmCallStatus.QUEUED;
        provider = result.provider;
        externalId = result.externalId;
      }
    }

    const call = await this.prisma.crmCallLog.create({
      data: {
        companyId,
        direction: dto.direction ?? CrmCommDirection.OUTBOUND,
        status,
        fromNumber: dto.fromNumber,
        toNumber: dto.toNumber,
        durationSec: dto.durationSec,
        notes: dto.notes,
        provider,
        externalId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
        startedAt: new Date(),
      },
    });

    await this.prisma.crmActivity.create({
      data: {
        companyId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
        type: CrmActivityType.CALL,
        body: `Call ${dto.direction ?? 'OUTBOUND'} ${dto.toNumber ?? ''}`.trim(),
      },
    });

    return call;
  }

  async listWhatsApp(companyId: string, query: ListCommsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const { skip, take } = paginate(page, limit);
    const where = {
      companyId,
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.crmWhatsAppMessage.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.crmWhatsAppMessage.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async createWhatsApp(companyId: string, userId: string, dto: CreateCrmWhatsAppDto) {
    let status: CrmMessageStatus = CrmMessageStatus.LOGGED;
    let externalId: string | undefined;

    if (dto.send && dto.toNumber) {
      const result = await this.integrations.sendWhatsApp({
        to: dto.toNumber,
        body: dto.body,
      });
      if (result.sent) {
        status = CrmMessageStatus.SENT;
        externalId = result.externalId;
      }
    }

    const msg = await this.prisma.crmWhatsAppMessage.create({
      data: {
        companyId,
        body: dto.body,
        toNumber: dto.toNumber,
        fromNumber: dto.fromNumber,
        mediaUrl: dto.mediaUrl,
        direction: dto.direction ?? CrmCommDirection.OUTBOUND,
        status,
        externalId,
        sentAt: status === CrmMessageStatus.SENT ? new Date() : undefined,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
      },
    });

    await this.prisma.crmActivity.create({
      data: {
        companyId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        createdById: userId,
        type: CrmActivityType.WHATSAPP,
        body: dto.body,
      },
    });

    return msg;
  }

  async listAttachments(companyId: string, query: ListCommsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where = {
      companyId,
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.crmAttachment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.crmAttachment.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async createAttachment(companyId: string, userId: string, dto: CreateCrmAttachmentDto) {
    return this.prisma.crmAttachment.create({
      data: {
        companyId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        uploadedById: userId,
      },
    });
  }
}

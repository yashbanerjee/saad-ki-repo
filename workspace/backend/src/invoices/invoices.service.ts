import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceBillingType, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../common/decorators';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceFilterDto,
  InvoiceLineItemDto,
} from './dto/invoice.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private isClient(user: AuthenticatedUser) {
    return user.roles?.includes('client') ?? false;
  }

  private async clientIdForUser(userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { userId },
      select: { id: true },
    });
    return client?.id ?? null;
  }

  private calcAmount(items: InvoiceLineItemDto[] | undefined, fallback?: number) {
    if (items?.length) {
      return items.reduce((sum, item) => {
        const qty = Number(item.quantity ?? 1);
        const price = Number(item.unitPrice ?? 0);
        return sum + qty * price;
      }, 0);
    }
    return Number(fallback ?? 0);
  }

  private serialize<T extends { amount: Prisma.Decimal | number }>(invoice: T) {
    return {
      ...invoice,
      amount: Number(invoice.amount),
    };
  }

  async findAll(
    user: AuthenticatedUser,
    filters: InvoiceFilterDto,
    page = 1,
    limit = 50,
  ) {
    const { skip, take } = paginate(page, limit);
    const companyId = user.companyId!;
    let clientScope: string | undefined;

    if (this.isClient(user)) {
      const cid = await this.clientIdForUser(user.id);
      if (!cid) return paginatedResponse([], 0, page, limit);
      clientScope = cid;
    }

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(clientScope ? { clientId: clientScope } : {}),
      ...(filters.clientId && !clientScope ? { clientId: filters.clientId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.billingType ? { billingType: filters.billingType } : {}),
      // Clients only see sent/paid/overdue — not drafts
      ...(clientScope
        ? { status: { in: [InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE] } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true, key: true } },
          milestone: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginatedResponse(
      data.map((row) => this.serialize(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true, key: true } },
        milestone: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (this.isClient(user)) {
      const cid = await this.clientIdForUser(user.id);
      if (!cid || invoice.clientId !== cid) {
        throw new ForbiddenException('Access denied');
      }
      if (invoice.status === InvoiceStatus.DRAFT) {
        throw new ForbiddenException('Invoice not available');
      }
    }

    return this.serialize(invoice);
  }

  async create(user: AuthenticatedUser, dto: CreateInvoiceDto) {
    const companyId = user.companyId!;
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) throw new NotFoundException('Client not found');

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId },
      });
      if (!project) throw new NotFoundException('Project not found');
    }

    if (dto.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: {
          id: dto.milestoneId,
          ...(dto.projectId ? { projectId: dto.projectId } : {}),
        },
      });
      if (!milestone) throw new NotFoundException('Milestone not found');
    }

    const amount = this.calcAmount(dto.items, dto.amount);
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { companyId } });
    const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectId: dto.projectId,
        milestoneId: dto.milestoneId,
        createdById: user.id,
        number,
        title: dto.title?.trim() || `Invoice ${number}`,
        billingType: dto.billingType,
        amount,
        currency: dto.currency || 'AED',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        items: (dto.items ?? []) as unknown as Prisma.InputJsonValue,
        status: InvoiceStatus.DRAFT,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return this.serialize(invoice);
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(id, user);
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    if (existing.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be edited');
    }

    const items = (dto.items ??
      (existing.items as unknown as InvoiceLineItemDto[])) as InvoiceLineItemDto[];
    const amount =
      dto.amount !== undefined || dto.items
        ? this.calcAmount(dto.items, dto.amount ?? Number(existing.amount))
        : undefined;

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        title: dto.title,
        billingType: dto.billingType,
        currency: dto.currency,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        ...(dto.items ? { items: dto.items as unknown as Prisma.InputJsonValue } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.status === InvoiceStatus.PAID ? { paidAt: new Date() } : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return this.serialize(invoice);
  }

  async send(id: string, user: AuthenticatedUser) {
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    await this.findOne(id, user);

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return this.serialize(invoice);
  }

  async markPaid(id: string, user: AuthenticatedUser) {
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    await this.findOne(id, user);

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return this.serialize(invoice);
  }

  async uploadPdf(id: string, user: AuthenticatedUser, file: Express.Multer.File) {
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    await this.findOne(id, user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a PDF file');
    }
    if (file.mimetype && !file.mimetype.includes('pdf') && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const key = this.storage.generateKey(
      `companies/${user.companyId}/invoices/${id}`,
      file.originalname || 'invoice.pdf',
    );
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype || 'application/pdf');

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        pdfName: file.originalname,
        pdfMimeType: file.mimetype || 'application/pdf',
        pdfSize: file.size,
        pdfStorageKey: key,
        pdfStorageUrl: url,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return this.serialize(invoice);
  }

  async createWithPdf(
    user: AuthenticatedUser,
    dto: CreateInvoiceDto,
    file?: Express.Multer.File,
  ) {
    const created = await this.create(user, dto);
    if (file?.buffer?.length) {
      return this.uploadPdf(created.id as string, user, file);
    }
    return created;
  }

  async remove(id: string, user: AuthenticatedUser) {
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    const existing = await this.findOne(id, user);
    if (existing.pdfStorageKey) {
      try {
        await this.storage.delete(String(existing.pdfStorageKey));
      } catch {
        /* ignore */
      }
    }
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Invoice deleted' };
  }
}

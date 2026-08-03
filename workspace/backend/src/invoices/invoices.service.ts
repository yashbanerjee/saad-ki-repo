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
    let number = dto.number?.trim();
    if (number) {
      const taken = await this.prisma.invoice.findFirst({
        where: { companyId, number },
      });
      if (taken) throw new BadRequestException(`Invoice number ${number} already exists`);
    } else {
      const count = await this.prisma.invoice.count({ where: { companyId } });
      number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }

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

  async nextNumber(user: AuthenticatedUser) {
    const companyId = user.companyId!;
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { companyId } });
    return { number: `INV-${year}-${String(count + 1).padStart(4, '0')}` };
  }

  async generatePdfBuffer(id: string, user: AuthenticatedUser): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        client: true,
        project: { select: { id: true, name: true, key: true } },
        company: { select: { name: true, email: true, phone: true, address: true, city: true, country: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (this.isClient(user)) {
      const cid = await this.clientIdForUser(user.id);
      if (!cid || invoice.clientId !== cid) throw new ForbiddenException('Access denied');
      if (invoice.status === InvoiceStatus.DRAFT) throw new ForbiddenException('Invoice not available');
    }

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const company = invoice.company;
    const client = invoice.client;
    const items = (Array.isArray(invoice.items) ? invoice.items : []) as Array<{
      description?: string;
      quantity?: number;
      unitPrice?: number;
    }>;
    const currency = invoice.currency || 'AED';
    const total = Number(invoice.amount);

    // Header
    doc
      .fillColor('#0F6661')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, 50, { align: 'left' });

    doc
      .fillColor('#111827')
      .fontSize(10)
      .font('Helvetica')
      .text(company.name || 'TaskFlow by Vedha', 50, 80)
      .text([company.email, company.phone].filter(Boolean).join(' · ') || '', 50, 94)
      .text(
        [company.address, company.city, company.country].filter(Boolean).join(', ') || '',
        50,
        108,
        { width: 250 },
      );

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`Invoice #: ${invoice.number}`, 320, 50, { align: 'right' })
      .font('Helvetica')
      .fontSize(10)
      .text(`Date: ${invoice.createdAt.toISOString().slice(0, 10)}`, 320, 68, { align: 'right' })
      .text(
        invoice.dueDate
          ? `Due: ${invoice.dueDate.toISOString().slice(0, 10)}`
          : 'Due: —',
        320,
        82,
        { align: 'right' },
      )
      .text(`Status: ${invoice.status}`, 320, 96, { align: 'right' })
      .text(`Type: ${invoice.billingType}`, 320, 110, { align: 'right' });

    // Bill to
    doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#E5E7EB').stroke();
    doc
      .fillColor('#6B7280')
      .fontSize(9)
      .text('BILL TO', 50, 160);
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(client.name || 'Client', 50, 175);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(client.email || '', 50, 190)
      .text([client.phone, client.city, client.country].filter(Boolean).join(' · '), 50, 204);

    if (invoice.project) {
      doc
        .fillColor('#6B7280')
        .fontSize(9)
        .text('PROJECT', 320, 160);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(invoice.project.name, 320, 175);
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(invoice.title || 'Invoice', 50, 240);

    // Table header
    const tableTop = 270;
    doc
      .rect(50, tableTop, 495, 24)
      .fill('#0F6661');
    doc
      .fillColor('#FFFFFF')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Description', 58, tableTop + 8)
      .text('Qty', 340, tableTop + 8, { width: 40, align: 'right' })
      .text('Rate', 390, tableTop + 8, { width: 60, align: 'right' })
      .text('Amount', 460, tableTop + 8, { width: 75, align: 'right' });

    let y = tableTop + 32;
    doc.fillColor('#111827').font('Helvetica').fontSize(10);

    if (!items.length) {
      doc.text('Services / deliverables', 58, y);
      doc.text('1', 340, y, { width: 40, align: 'right' });
      doc.text(`${total.toFixed(2)}`, 390, y, { width: 60, align: 'right' });
      doc.text(`${total.toFixed(2)}`, 460, y, { width: 75, align: 'right' });
      y += 22;
    } else {
      for (const item of items) {
        const qty = Number(item.quantity ?? 1);
        const rate = Number(item.unitPrice ?? 0);
        const line = qty * rate;
        const desc = String(item.description || 'Item');
        doc.text(desc, 58, y, { width: 270 });
        doc.text(String(qty), 340, y, { width: 40, align: 'right' });
        doc.text(rate.toFixed(2), 390, y, { width: 60, align: 'right' });
        doc.text(line.toFixed(2), 460, y, { width: 75, align: 'right' });
        y += Math.max(22, Math.ceil(desc.length / 45) * 12);
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }
    }

    y += 10;
    doc.moveTo(340, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
    y += 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Total', 340, y)
      .text(`${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 420, y, {
        width: 115,
        align: 'right',
      });

    if (invoice.notes) {
      y += 40;
      doc
        .fillColor('#6B7280')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('NOTES / PAYMENT TERMS', 50, y);
      y += 14;
      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10)
        .text(invoice.notes, 50, y, { width: 495 });
    }

    doc
      .fillColor('#9CA3AF')
      .fontSize(8)
      .text('Generated by TaskFlow by Vedha', 50, 780, { align: 'center', width: 495 });

    doc.end();
    const buffer = await done;
    return { buffer, filename: `${invoice.number}.pdf` };
  }

  async generateAndStorePdf(id: string, user: AuthenticatedUser) {
    if (this.isClient(user)) throw new ForbiddenException('Access denied');
    const { buffer, filename } = await this.generatePdfBuffer(id, user);
    const key = this.storage.generateKey(
      `companies/${user.companyId}/invoices/${id}`,
      filename,
    );
    const { url } = await this.storage.upload(key, buffer, 'application/pdf');
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        pdfName: filename,
        pdfMimeType: 'application/pdf',
        pdfSize: buffer.length,
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
    // Auto-generate a downloadable PDF (Refrens-style)
    try {
      return await this.generateAndStorePdf(created.id as string, user);
    } catch {
      return created;
    }
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

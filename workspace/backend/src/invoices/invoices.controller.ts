import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceFilterDto,
} from './dto/invoice.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

const uploadMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
};

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(PermissionsGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @Permissions('invoices:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: InvoiceFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.invoicesService.findAll(
      user,
      filters,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('next-number')
  @Permissions('invoices:manage')
  nextNumber(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.nextNumber(user);
  }

  @Get(':id')
  @Permissions('invoices:read')
  findOne(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.findOne(id, user);
  }

  @Get(':id/download')
  @Permissions('invoices:read')
  @Header('Content-Type', 'application/pdf')
  async download(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoicesService.generatePdfBuffer(
      id,
      user,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Post()
  @Permissions('invoices:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user, dto);
  }

  @Post('with-pdf')
  @Permissions('invoices:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        clientId: { type: 'string' },
        number: { type: 'string' },
        projectId: { type: 'string' },
        milestoneId: { type: 'string' },
        title: { type: 'string' },
        billingType: { type: 'string' },
        currency: { type: 'string' },
        dueDate: { type: 'string' },
        notes: { type: 'string' },
        amount: { type: 'number' },
        items: { type: 'string', description: 'JSON string of line items' },
      },
      required: ['clientId', 'billingType'],
    },
  })
  createWithPdf(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
  ) {
    let items: CreateInvoiceDto['items'];
    if (body.items) {
      try {
        items = JSON.parse(body.items);
      } catch {
        throw new BadRequestException('Invalid items JSON');
      }
    }

    const dto: CreateInvoiceDto = {
      clientId: body.clientId,
      number: body.number || undefined,
      projectId: body.projectId || undefined,
      milestoneId: body.milestoneId || undefined,
      title: body.title || undefined,
      billingType: body.billingType as CreateInvoiceDto['billingType'],
      currency: body.currency || undefined,
      dueDate: body.dueDate || undefined,
      notes: body.notes || undefined,
      amount: body.amount ? Number(body.amount) : undefined,
      items,
    };

    return this.invoicesService.createWithPdf(user, dto, file);
  }

  @Patch(':id')
  @Permissions('invoices:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, user, dto);
  }

  @Post(':id/send')
  @Permissions('invoices:manage')
  send(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.send(id, user);
  }

  @Post(':id/mark-paid')
  @Permissions('invoices:manage')
  markPaid(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.markPaid(id, user);
  }

  @Post(':id/generate-pdf')
  @Permissions('invoices:manage')
  generatePdf(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.generateAndStorePdf(id, user);
  }

  @Post(':id/pdf')
  @Permissions('invoices:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  uploadPdf(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Please choose a PDF file');
    return this.invoicesService.uploadPdf(id, user, file);
  }

  @Delete(':id')
  @Permissions('invoices:manage')
  remove(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.remove(id, user);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateFolderDto } from './dto/document.dto';
import { DocumentType } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async findAll(companyId: string, folderId?: string, projectId?: string) {
    return this.prisma.document.findMany({
      where: {
        companyId,
        ...(folderId ? { folderId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findFolders(companyId: string, parentId?: string) {
    return this.prisma.documentFolder.findMany({
      where: { companyId, parentId: parentId ?? null },
      include: { _count: { select: { documents: true, children: true } } },
    });
  }

  async createFolder(companyId: string, dto: CreateFolderDto) {
    return this.prisma.documentFolder.create({
      data: {
        companyId,
        name: dto.name,
        ...(dto.parentId
          ? { parent: { connect: { id: dto.parentId } } }
          : {}),
      },
    });
  }

  async upload(
    companyId: string,
    uploadedById: string,
    file: Express.Multer.File,
    meta: { name: string; type?: DocumentType; clientId?: string; projectId?: string; folderId?: string },
  ) {
    const key = this.storage.generateKey(`companies/${companyId}`, file.originalname);
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.document.create({
      data: {
        companyId,
        uploadedById,
        name: meta.name,
        originalName: file.originalname,
        type: meta.type ?? 'CUSTOM',
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageUrl: url,
        clientId: meta.clientId,
        projectId: meta.projectId,
        folderId: meta.folderId,
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, companyId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getDownloadUrl(id: string, companyId: string) {
    const doc = await this.findOne(id, companyId);
    const url = await this.storage.getSignedUrl(doc.storageKey);
    return { url, name: doc.name, mimeType: doc.mimeType };
  }

  async remove(id: string, companyId: string) {
    const doc = await this.findOne(id, companyId);
    await this.storage.delete(doc.storageKey);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted' };
  }
}

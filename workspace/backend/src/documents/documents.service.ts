import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateFolderDto } from './dto/document.dto';
import { DocumentType } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators';
import { TrashService } from '../trash/trash.service';
import { renderNdaPlaceholders } from '../nda/nda-placeholders';
import { memoryStorage } from 'multer';

export const uploadMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private trash: TrashService,
  ) {}

  private isClientUser(user: AuthenticatedUser) {
    return user.roles?.includes('client');
  }

  private isCompanyAdmin(user: AuthenticatedUser) {
    return (
      user.roles?.includes('company_admin') ||
      user.roles?.includes('super_admin') ||
      user.roles?.includes('admin') ||
      // Managers who manage clients can see all client uploads
      user.permissions?.includes('clients:manage') === true
    );
  }

  private async resolveClientId(user: AuthenticatedUser): Promise<string | null> {
    const linked = await this.prisma.client.findFirst({
      where: { userId: user.id, companyId: user.companyId! },
      select: { id: true },
    });
    return linked?.id ?? null;
  }

  /** Client IDs this staff member can access (via project membership). */
  private async getAssignedClientIds(user: AuthenticatedUser): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId: user.id,
        project: { companyId: user.companyId!, clientId: { not: null } },
      },
      select: { project: { select: { clientId: true } } },
    });
    return [
      ...new Set(
        memberships
          .map((m) => m.project.clientId)
          .filter((id): id is string => !!id),
      ),
    ];
  }

  private async canAccessClientDoc(
    user: AuthenticatedUser,
    clientId: string | null | undefined,
    uploadedById?: string | null,
  ): Promise<boolean> {
    if (this.isCompanyAdmin(user)) return true;
    if (uploadedById && uploadedById === user.id) return true;
    if (!clientId) {
      // Company-wide docs: readable by any staff with documents:read
      return !this.isClientUser(user);
    }
    if (this.isClientUser(user)) {
      const linked = await this.resolveClientId(user);
      return linked === clientId;
    }
    const assigned = await this.getAssignedClientIds(user);
    return assigned.includes(clientId);
  }

  async findAll(
    user: AuthenticatedUser,
    folderId?: string,
    projectId?: string,
  ) {
    const companyId = user.companyId!;
    const isClient = this.isClientUser(user);
    const isAdmin = this.isCompanyAdmin(user);
    const linkedClientId = isClient ? await this.resolveClientId(user) : null;

    if (isClient && !linkedClientId) {
      return { documents: [], ndaDocuments: [], items: [] };
    }

    const assignedClientIds =
      !isClient && !isAdmin ? await this.getAssignedClientIds(user) : [];

    const accessFilter = isClient
      ? { clientId: linkedClientId! }
      : isAdmin
        ? {}
        : {
            OR: [
              { clientId: null },
              { clientId: { in: assignedClientIds } },
              { uploadedById: user.id },
            ],
          };

    const documents = await this.prisma.document.findMany({
      where: {
        companyId,
        ...accessFilter,
        ...(folderId ? { folderId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let ndaWhere: Record<string, unknown>;
    if (isClient && linkedClientId) {
      ndaWhere = {
        status: 'SIGNED',
        clientId: linkedClientId,
        ndaTemplate: { companyId },
      };
    } else if (isAdmin) {
      ndaWhere = {
        status: 'SIGNED',
        ndaTemplate: { companyId },
      };
    } else {
      ndaWhere = {
        status: 'SIGNED',
        clientId: { in: assignedClientIds },
        ndaTemplate: { companyId },
      };
    }

    const signatures = await this.prisma.digitalSignature.findMany({
      where: ndaWhere,
      include: {
        ndaTemplate: {
          select: { id: true, title: true, content: true, version: true },
        },
        client: { select: { id: true, name: true } },
      },
      orderBy: { signedAt: 'desc' },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const ndaDocuments = signatures.map((sig) => ({
      id: `nda-${sig.id}`,
      kind: 'nda' as const,
      name: `${sig.ndaTemplate.title} (Signed)`,
      originalName: `${sig.ndaTemplate.title}.nda.txt`,
      type: 'NDA' as DocumentType,
      mimeType: 'text/plain',
      size: 0,
      folder: 'NDA',
      folderId: null,
      clientId: sig.clientId,
      client: sig.client,
      storageUrl: null,
      signedAt: sig.signedAt,
      createdAt: sig.signedAt ?? sig.createdAt,
      updatedAt: sig.updatedAt,
      contentPreview: renderNdaPlaceholders(sig.ndaTemplate.content, {
        companyName: company?.name,
        clientName: sig.client?.name,
      }),
      signatureId: sig.id,
      templateId: sig.ndaTemplate.id,
      version: String(sig.ndaTemplate.version),
    }));

    const mappedDocs = documents.map((d) => ({
      ...d,
      kind: 'file' as const,
      folder: d.folder?.name ?? (d.clientId ? 'Client uploads' : 'General'),
    }));

    return {
      documents: mappedDocs,
      ndaDocuments,
      items: [...ndaDocuments, ...mappedDocs],
    };
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
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    meta: {
      name?: string;
      type?: DocumentType;
      clientId?: string;
      projectId?: string;
      folderId?: string;
      isClientVisible?: boolean;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a file to upload');
    }

    const companyId = user.companyId!;
    const isClient = this.isClientUser(user);
    const linkedClientId = isClient ? await this.resolveClientId(user) : null;

    if (isClient) {
      if (!linkedClientId) {
        throw new ForbiddenException(
          'No client profile linked to this account. Ask an admin to link your user to a client.',
        );
      }
    } else {
      const canUpload =
        user.permissions?.includes('documents:manage') ||
        user.permissions?.includes('documents:read') ||
        this.isCompanyAdmin(user);
      if (!canUpload) {
        throw new ForbiddenException('Insufficient permissions to upload documents');
      }
    }

    const clientId = isClient ? linkedClientId! : meta.clientId;
    // Client uploads are always visible on their portal by default
    const isClientVisible = isClient
      ? true
      : meta.isClientVisible === true;

    try {
      const key = this.storage.generateKey(
        `companies/${companyId}${clientId ? `/clients/${clientId}` : ''}`,
        file.originalname || 'upload.bin',
      );
      const { url } = await this.storage.upload(
        key,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );

      return this.prisma.document.create({
        data: {
          companyId,
          uploadedById: user.id,
          name: (meta.name || file.originalname || 'Upload').trim(),
          originalName: file.originalname || 'upload.bin',
          type: meta.type ?? 'CUSTOM',
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          storageKey: key,
          storageUrl: url,
          clientId: clientId || undefined,
          projectId: meta.projectId || undefined,
          folderId: meta.folderId || undefined,
          isClientVisible,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Upload failed — check storage configuration';
      throw new BadRequestException(message);
    }
  }

  async updateDocument(
    id: string,
    user: AuthenticatedUser,
    data: {
      name?: string;
      isClientVisible?: boolean;
      projectId?: string | null;
      clientId?: string | null;
    },
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id, companyId: user.companyId! },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (this.isClientUser(user)) {
      throw new ForbiddenException('Clients cannot change document visibility settings');
    }
    if (
      !user.permissions?.includes('documents:manage') &&
      !user.permissions?.includes('documents:read') &&
      !this.isCompanyAdmin(user)
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isClientVisible !== undefined
          ? { isClientVisible: data.isClientVisible }
          : {}),
        ...(data.projectId !== undefined
          ? { projectId: data.projectId || null }
          : {}),
        ...(data.clientId !== undefined
          ? { clientId: data.clientId || null }
          : {}),
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    if (id.startsWith('nda-')) {
      return this.getNdaDocument(id.slice(4), user);
    }

    const doc = await this.prisma.document.findFirst({
      where: { id, companyId: user.companyId! },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const allowed = await this.canAccessClientDoc(user, doc.clientId, doc.uploadedById);
    if (!allowed) {
      throw new ForbiddenException('Not allowed to access this document');
    }
    return { ...doc, kind: 'file' as const };
  }

  private async getNdaDocument(signatureId: string, user: AuthenticatedUser) {
    const sig = await this.prisma.digitalSignature.findFirst({
      where: {
        id: signatureId,
        status: 'SIGNED',
        ndaTemplate: { companyId: user.companyId! },
      },
      include: {
        ndaTemplate: true,
        client: { select: { id: true, name: true } },
      },
    });
    if (!sig) throw new NotFoundException('Signed NDA not found');

    const allowed = await this.canAccessClientDoc(user, sig.clientId);
    if (!allowed) {
      throw new ForbiddenException('Not allowed to access this NDA');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId! },
      select: { name: true },
    });

    const content = renderNdaPlaceholders(sig.ndaTemplate.content, {
      companyName: company?.name,
      clientName: sig.client?.name,
    });

    return {
      id: `nda-${sig.id}`,
      kind: 'nda' as const,
      name: `${sig.ndaTemplate.title} (Signed)`,
      type: 'NDA',
      content,
      signedAt: sig.signedAt,
      client: sig.client,
      signatureType: sig.signatureType,
      signatureData: sig.signatureData,
    };
  }

  async getDownloadUrl(id: string, user: AuthenticatedUser) {
    if (id.startsWith('nda-')) {
      const nda = await this.getNdaDocument(id.slice(4), user);
      const body = [
        nda.content,
        '',
        '────────────────────────────────',
        `Signed at: ${nda.signedAt?.toISOString?.() ?? nda.signedAt}`,
        `Signer: ${nda.client?.name ?? 'Client'}`,
        `Signature type: ${nda.signatureType ?? 'N/A'}`,
      ].join('\n');

      return {
        kind: 'inline',
        name: `${nda.name}.txt`,
        mimeType: 'text/plain',
        content: body,
      };
    }

    const doc = await this.findOne(id, user);
    if (!('storageKey' in doc) || !doc.storageKey) {
      throw new NotFoundException('File not available');
    }

    // External portal links
    if (
      doc.mimeType === 'text/uri-list' ||
      String(doc.storageKey).startsWith('portal-link/')
    ) {
      if (doc.storageUrl) {
        return {
          kind: 'url',
          url: doc.storageUrl,
          name: doc.name,
          mimeType: doc.mimeType,
        };
      }
      throw new NotFoundException('Link not available');
    }

    // Prefer a public/signed URL when available
    if (doc.storageUrl) {
      return {
        kind: 'url',
        url: doc.storageUrl,
        name: doc.name,
        mimeType: doc.mimeType,
      };
    }

    const signed = await this.storage.getSignedUrl(doc.storageKey);
    if (signed) {
      return { kind: 'url', url: signed, name: doc.name, mimeType: doc.mimeType };
    }

    // Local (or private) storage: stream as base64 for the browser to save
    const buffer = await this.storage.getObjectBuffer(doc.storageKey);
    return {
      kind: 'base64',
      name: doc.originalName || doc.name,
      mimeType: doc.mimeType || 'application/octet-stream',
      content: buffer.toString('base64'),
      size: buffer.length,
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    if (id.startsWith('nda-')) {
      throw new BadRequestException('Signed NDAs cannot be deleted from Documents');
    }

    const doc = await this.prisma.document.findFirst({
      where: { id, companyId: user.companyId! },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (this.isClientUser(user)) {
      const linkedClientId = await this.resolveClientId(user);
      if (!linkedClientId || doc.clientId !== linkedClientId) {
        throw new ForbiddenException('Not allowed to delete this document');
      }
    } else {
      const canDelete =
        user.permissions?.includes('documents:manage') ||
        this.isCompanyAdmin(user) ||
        doc.uploadedById === user.id;
      if (!canDelete) {
        throw new ForbiddenException('Insufficient permissions to delete documents');
      }
    }

    await this.trash.moveToTrash({
      companyId: user.companyId!,
      userId: user.id,
      entityType: 'document',
      entityId: id,
      title: doc.originalName || doc.name,
      href: '/documents',
    });
    return { message: 'Moved to trash' };
  }

  /** Ensure client role has documents:manage in DB (for existing tenants). */
  async ensureClientUploadPermission(companyId: string) {
    const role = await this.prisma.role.findFirst({
      where: { companyId, slug: 'client' },
    });
    if (!role) return;
    const perm = await this.prisma.permission.findFirst({
      where: { slug: 'documents:manage' },
    });
    if (!perm) return;
    await this.prisma.rolePermission.createMany({
      data: [{ roleId: role.id, permissionId: perm.id }],
      skipDuplicates: true,
    });
  }
}

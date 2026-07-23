import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] });
  }

  async findOne(id: string, companyId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, companyId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(companyId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { companyId, slug: dto.slug },
    });
    if (existing) throw new ConflictException('Role slug already exists');

    return this.prisma.role.create({
      data: {
        companyId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        permissions: dto.permissionIds?.length
          ? { create: dto.permissionIds.map((permissionId) => ({ permissionId })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, companyId: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id, companyId);
    if (role.isSystem) throw new ForbiddenException('Cannot modify system roles');

    if (dto.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }

    return this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string, companyId: string) {
    const role = await this.findOne(id, companyId);
    if (role.isSystem) throw new ForbiddenException('Cannot delete system roles');
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }
}

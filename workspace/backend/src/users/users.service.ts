import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto } from './dto/user.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async findAll(companyId: string, page = 1, limit = 20) {
    const { skip, take } = paginate(page, limit);
    const where = { companyId };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginatedResponse(data.map(this.stripSensitive), total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.stripSensitive(user);
  }

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'ACTIVE',
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });
    return this.stripSensitive(user);
  }

  async update(id: string, companyId: string, dto: UpdateUserDto) {
    await this.findOne(id, companyId);

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: dto.status,
      },
      include: { roles: { include: { role: true } } },
    });
    return this.stripSensitive(user);
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { message: 'User deactivated' };
  }

  async invite(companyId: string, invitedBy: string, dto: InviteUserDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.invitation.create({
      data: {
        companyId,
        email: dto.email,
        roleId: dto.roleId,
        token,
        invitedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.mail.sendInvitationEmail(dto.email, token, company.name);
    return invitation;
  }

  private stripSensitive<T extends { passwordHash?: string; twoFactorSecret?: string | null }>(user: T) {
    const { passwordHash, twoFactorSecret, ...safe } = user;
    return safe;
  }
}

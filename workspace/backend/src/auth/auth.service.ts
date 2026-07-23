import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import {
  PERMISSION_DEFINITIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from '../common/constants/permissions.constants';
import {
  RegisterCompanyDto,
  LoginDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async registerCompany(dto: RegisterCompanyDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slug = this.slugify(dto.companyName);
    const slugTaken = await this.prisma.company.findUnique({ where: { slug } });
    if (slugTaken) throw new ConflictException('Company name already taken');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      for (const perm of PERMISSION_DEFINITIONS) {
        await tx.permission.upsert({
          where: { slug: perm.slug },
          create: perm,
          update: {},
        });
      }

      const allPermissions = await tx.permission.findMany();
      const permMap = new Map(allPermissions.map((p) => [p.slug, p.id]));

      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          slug,
          email: dto.email,
          phone: dto.phone,
          subscription: {
            create: {
              plan: 'trial',
              currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      const roles: Record<string, string> = {};
      for (const roleSlug of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
            name: ROLE_NAMES[roleSlug],
            slug: roleSlug,
            isSystem: true,
            description: `System role: ${ROLE_NAMES[roleSlug]}`,
          },
        });
        roles[roleSlug] = role.id;

        const slugs = ROLE_PERMISSIONS[roleSlug] ?? [];
        for (const permSlug of slugs) {
          const permId = permMap.get(permSlug);
          if (permId) {
            await tx.rolePermission.create({
              data: { roleId: role.id, permissionId: permId },
            });
          }
        }
      }

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          status: 'PENDING_VERIFICATION',
          roles: { create: { roleId: roles.company_admin } },
        },
      });

      const verifyToken = randomBytes(32).toString('hex');
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: verifyToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return { company, user, verifyToken };
    });

    await this.mail.sendVerificationEmail(dto.email, result.verifyToken);

    const tokens = await this.issueTokens(result.user.id, ip, userAgent);
    await this.audit.log({
      companyId: result.company.id,
      userId: result.user.id,
      action: AuditAction.CREATE,
      entityType: 'Company',
      entityId: result.company.id,
      ipAddress: ip,
      userAgent,
    });

    return {
      company: { id: result.company.id, name: result.company.name, slug: result.company.slug },
      user: this.sanitizeUser(result.user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const tokens = await this.issueTokens(user.id, ip, userAgent);
    await this.audit.log({
      companyId: user.companyId,
      userId: user.id,
      action: AuditAction.LOGIN,
      ipAddress: ip,
      userAgent,
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(userId: string, tokenId: string, ip?: string, userAgent?: string) {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });

    const tokens = await this.issueTokens(userId, ip, userAgent);
    return tokens;
  }

  async logout(userId: string, tokenId?: string) {
    if (tokenId) {
      await this.prisma.refreshToken.updateMany({
        where: { id: tokenId, userId },
        data: { revoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    }

    await this.audit.log({ userId, action: AuditAction.LOGOUT });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset link has been sent' };

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.mail.sendPasswordResetEmail(email, token);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { revoked: true },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { token: dto.token },
    });

    if (!token || token.used || token.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  private async issueTokens(userId: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();

    const roles = user.roles.map((ur) => ur.role.slug);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.slug),
        ),
      ),
    ];

    const refreshRecord = await this.prisma.refreshToken.create({
      data: {
        userId,
        token: randomBytes(48).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ip,
        userAgent,
      },
    });

    const payload = {
      sub: userId,
      email: user.email,
      companyId: user.companyId,
      roles,
      permissions,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(
      { sub: userId, tokenId: refreshRecord.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
    phone?: string | null;
    status: string;
    emailVerified: boolean;
    companyId?: string | null;
    roles?: unknown;
    company?: unknown;
  }) {
    const { passwordHash, twoFactorSecret, ...safe } = user as Record<string, unknown> & {
      passwordHash?: string;
      twoFactorSecret?: string;
    };
    return safe;
  }
}

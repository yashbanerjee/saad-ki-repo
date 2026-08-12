import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthenticatedUser } from '../../common/decorators';
import { ROLE_PERMISSIONS } from '../../common/constants/permissions.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User not found or suspended');
    }

    const roles = user.roles.map((ur) => ur.role.slug);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.slug),
        ),
      ),
    ];

    // Merge canonical ROLE_PERMISSIONS so older DB role seeds stay in sync
    // (e.g. invoices:manage on company_admin / project_manager).
    for (const role of roles) {
      const expected = ROLE_PERMISSIONS[role];
      if (!expected) continue;
      for (const slug of expected) {
        if (!permissions.includes(slug)) permissions.push(slug);
      }
    }

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      companyId: user.companyId ?? undefined,
      roles,
      permissions,
    };
  }
}

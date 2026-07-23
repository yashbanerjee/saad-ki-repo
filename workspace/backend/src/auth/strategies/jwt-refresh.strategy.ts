import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface RefreshPayload {
  sub: string;
  tokenId: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromBodyField('refreshToken'),
        (req) => req?.cookies?.refresh_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  async validate(
    req: { body?: { refreshToken?: string }; cookies?: { refresh_token?: string } },
    payload: RefreshPayload,
  ) {
    const token = req.body?.refreshToken ?? req.cookies?.refresh_token;
    if (!token) throw new UnauthorizedException('Refresh token required');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { id: payload.tokenId, userId: payload.sub, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { userId: payload.sub, tokenId: payload.tokenId, rawToken: token };
  }
}

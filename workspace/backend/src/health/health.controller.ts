import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';

/** Bump when shipping API route changes — used to confirm Railway is on latest build. */
export const API_BUILD_ID = '2026-07-25-dashboard-put-fields';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      buildId: API_BUILD_ID,
      routes: {
        dashboardStats: true,
        dashboardActivity: true,
        onboardingPutSave: true,
      },
      services: { database: db },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(companyId: string, query: string, limit = 10) {
    const search = { contains: query, mode: 'insensitive' as const };

    const [projects, issues, clients, users] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId, OR: [{ name: search }, { key: search }] },
        take: limit,
        select: { id: true, key: true, name: true, status: true },
      }),
      this.prisma.issue.findMany({
        where: {
          project: { companyId },
          OR: [{ title: search }, { key: search }, { description: search }],
        },
        take: limit,
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          project: { select: { key: true, name: true } },
        },
      }),
      this.prisma.client.findMany({
        where: { companyId, OR: [{ name: search }, { email: search }, { companyName: search }] },
        take: limit,
        select: { id: true, name: true, email: true, companyName: true },
      }),
      this.prisma.user.findMany({
        where: {
          companyId,
          OR: [
            { firstName: search },
            { lastName: search },
            { email: search },
          ],
        },
        take: limit,
        select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
      }),
    ]);

    return { projects, issues, clients, users };
  }
}

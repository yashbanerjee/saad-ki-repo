import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, CreateTeamDto, AddTeamMemberDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async findDepartments(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: { teams: true },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(companyId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { companyId, name: dto.name, description: dto.description },
    });
  }

  async findTeams(companyId: string, departmentId?: string) {
    return this.prisma.team.findMany({
      where: { companyId, ...(departmentId ? { departmentId } : {}) },
      include: {
        department: true,
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
        },
      },
    });
  }

  async createTeam(companyId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
      },
    });
  }

  async addMember(teamId: string, companyId: string, dto: AddTeamMemberDto) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new NotFoundException('Team not found');

    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: dto.userId } },
      create: { teamId, userId: dto.userId, role: dto.role ?? 'member' },
      update: { role: dto.role ?? 'member' },
    });
  }

  async removeMember(teamId: string, companyId: string, userId: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    return { message: 'Member removed' };
  }
}

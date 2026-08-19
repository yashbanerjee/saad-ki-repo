import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  WON: 'Won',
  LOST: 'Lost',
};

const DEAL_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

const OPEN_DEAL_STATUSES = ['OPEN', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION'];
const OPEN_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'];
const FUNNEL_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON'];

const DEAL_PROBABILITY: Record<string, number> = {
  OPEN: 0.1,
  QUALIFICATION: 0.25,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.75,
  WON: 1,
  LOST: 0,
};

const STATUS_CHANGE_RE = /status changed from ([A-Z_]+) to ([A-Z_]+)/i;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async projectSummary(companyId: string) {
    const [projects, issueGroups] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId },
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          _count: { select: { issues: true, members: true, sprints: true } },
        },
      }),
      this.prisma.issue.groupBy({
        by: ['projectId', 'status'],
        where: { project: { companyId }, deletedAt: null },
        _count: true,
      }),
    ]);

    const health = new Map<
      string,
      { onTrack: number; atRisk: number; blocked: number; done: number }
    >();
    for (const group of issueGroups) {
      const row = health.get(group.projectId) ?? {
        onTrack: 0,
        atRisk: 0,
        blocked: 0,
        done: 0,
      };
      const count = asCount(group._count);
      if (group.status === 'DONE') row.done += count;
      else if (group.status === 'BLOCKED') row.blocked += count;
      else if (group.status === 'QA_FAILED' || group.status === 'CANCELLED') {
        row.atRisk += count;
      } else {
        row.onTrack += count;
      }
      health.set(group.projectId, row);
    }

    return projects.map((project) => ({
      ...project,
      issueCount: project._count.issues,
      memberCount: project._count.members,
      sprintCount: project._count.sprints,
      ...(health.get(project.id) ?? {
        onTrack: 0,
        atRisk: 0,
        blocked: 0,
        done: 0,
      }),
    }));
  }

  async issueReport(companyId: string, projectId?: string) {
    const where = {
      project: { companyId, ...(projectId ? { id: projectId } : {}) },
      deletedAt: null,
    };

    const [byType, byPriority, byAssignee, overdue] = await Promise.all([
      this.prisma.issue.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.issue.groupBy({ by: ['priority'], where, _count: true }),
      this.prisma.issue.groupBy({ by: ['assigneeId'], where, _count: true }),
      this.prisma.issue.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
    ]);

    return { byType, byPriority, byAssignee, overdueCount: overdue };
  }

  async sprintVelocity(companyId: string, projectId: string) {
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId, project: { companyId } },
      include: {
        issues: {
          select: { storyPoints: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      totalPoints: sprint.issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
      completedPoints: sprint.issues
        .filter((issue) => issue.status === 'DONE')
        .reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
      issueCount: sprint.issues.length,
    }));
  }

  async userActivity(companyId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.activityLog.groupBy({
      by: ['userId'],
      where: { companyId, createdAt: { gte: since }, userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 20,
    });
  }

  async crmSummary(companyId: string, days = 30) {
    const periodDays = Number.isFinite(days) ? Math.max(0, days) : 30;
    const since =
      periodDays > 0
        ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
        : new Date(0);
    const now = new Date();
    const trendDays = periodDays === 0 ? 90 : periodDays;

    const [
      leads,
      deals,
      clientGroups,
      contactCount,
      organizationCount,
      taskGroups,
      overdueTasks,
      notesInPeriod,
      activities,
      activityGroups,
    ] = await Promise.all([
      this.prisma.lead.findMany({
        where: { companyId, archived: false },
        select: {
          id: true,
          title: true,
          name: true,
          status: true,
          source: true,
          estimatedValue: true,
          lostReason: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          convertedAt: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.deal.findMany({
        where: { companyId },
        select: {
          id: true,
          title: true,
          status: true,
          amount: true,
          lostReason: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          expectedCloseDate: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.client.groupBy({
        by: ['type'],
        where: { companyId, status: 'active', deletedAt: null },
        _count: true,
      }),
      this.prisma.contact.count({ where: { companyId } }),
      this.prisma.organization.count({ where: { companyId } }),
      this.prisma.crmTask.groupBy({
        by: ['status'],
        where: { companyId, deletedAt: null },
        _count: true,
      }),
      this.prisma.crmTask.count({
        where: {
          companyId,
          dueDate: { lt: now },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
      this.prisma.crmNote.count({
        where: { companyId, createdAt: { gte: since } },
      }),
      this.prisma.crmActivity.findMany({
        where: { companyId, type: 'STATUS_CHANGE' },
        select: { body: true, leadId: true, dealId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.crmActivity.groupBy({
        by: ['type'],
        where: { companyId, createdAt: { gte: since } },
        _count: true,
      }),
    ]);

    const leadsByStatusCounts: Record<string, number> = {};
    const leadsByStatusValue: Record<string, number> = {};
    const leadsBySource: Record<string, number> = {};
    const lostReasons: Record<string, number> = {};
    let estimatedOpenValue = 0;

    for (const lead of leads) {
      leadsByStatusCounts[lead.status] = (leadsByStatusCounts[lead.status] ?? 0) + 1;
      const value = num(lead.estimatedValue);
      leadsByStatusValue[lead.status] = (leadsByStatusValue[lead.status] ?? 0) + value;
      leadsBySource[lead.source] = (leadsBySource[lead.source] ?? 0) + 1;
      if (OPEN_LEAD_STATUSES.includes(lead.status)) estimatedOpenValue += value;
      if (lead.status === 'LOST') {
        const reason = lead.lostReason?.trim() || 'Unspecified';
        lostReasons[reason] = (lostReasons[reason] ?? 0) + 1;
      }
    }

    const dealsByStatusCounts: Record<string, { count: number; amount: number }> = {};
    let pipelineValue = 0;
    let weightedPipeline = 0;
    let wonDealValue = 0;
    let closingSoon = 0;
    const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    for (const deal of deals) {
      const amount = num(deal.amount);
      const bucket = dealsByStatusCounts[deal.status] ?? { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += amount;
      dealsByStatusCounts[deal.status] = bucket;
      if (OPEN_DEAL_STATUSES.includes(deal.status)) {
        pipelineValue += amount;
        weightedPipeline += amount * (DEAL_PROBABILITY[deal.status] ?? 0);
        if (deal.expectedCloseDate && deal.expectedCloseDate <= soon) closingSoon += 1;
      }
      if (deal.status === 'WON') wonDealValue += amount;
      if (deal.status === 'LOST') {
        const reason = deal.lostReason?.trim() || 'Unspecified';
        lostReasons[reason] = (lostReasons[reason] ?? 0) + 1;
      }
    }

    const totalLeads = leads.length;
    const convertedLeads = leadsByStatusCounts.WON ?? 0;
    const lostLeads = leadsByStatusCounts.LOST ?? 0;
    const openLeads = OPEN_LEAD_STATUSES.reduce(
      (sum, status) => sum + (leadsByStatusCounts[status] ?? 0),
      0,
    );

    const clientsByType = Object.fromEntries(
      clientGroups.map((group) => [group.type, asCount(group._count)]),
    );
    const activeClients =
      Number(clientsByType.COMPANY ?? 0) + Number(clientsByType.INDIVIDUAL ?? 0);

    const tasksByStatus = Object.fromEntries(
      taskGroups.map((group) => [group.status, asCount(group._count)]),
    );
    const openTasks = ['BACKLOG', 'TODO', 'IN_PROGRESS'].reduce(
      (sum, status) => sum + Number(tasksByStatus[status] ?? 0),
      0,
    );

    const funnel = FUNNEL_STAGES.map((stage, index) => {
      const count = FUNNEL_STAGES.slice(index).reduce(
        (sum, key) => sum + (leadsByStatusCounts[key] ?? 0),
        0,
      );
      const previous =
        index === 0
          ? count
          : FUNNEL_STAGES.slice(index - 1).reduce(
              (sum, key) => sum + (leadsByStatusCounts[key] ?? 0),
              0,
            );
      return {
        stage,
        label: LEAD_STATUS_LABELS[stage] ?? stage,
        count,
        conversionFromPrevious:
          previous > 0 ? Math.round((count / previous) * 1000) / 10 : 0,
      };
    });

    const leadTransitions = activities
      .filter((row) => row.leadId)
      .map((row) => parseStatusChange(row.body))
      .filter((row): row is { from: string; to: string } => !!row);
    const dealTransitions = activities
      .filter((row) => row.dealId)
      .map((row) => parseStatusChange(row.body))
      .filter((row): row is { from: string; to: string } => !!row);

    const leadSankey = buildSankey(
      leadTransitions,
      leadsByStatusCounts,
      LEAD_STATUS_LABELS,
    );
    const dealSankey = buildSankey(
      dealTransitions,
      Object.fromEntries(
        Object.entries(dealsByStatusCounts).map(([status, row]) => [status, row.count]),
      ),
      DEAL_STATUS_LABELS,
    );

    const trend = buildTrend(leads, trendDays);

    const owners = buildOwners(leads, deals);

    const topOpenLeads = [...leads]
      .filter((lead) => OPEN_LEAD_STATUSES.includes(lead.status))
      .sort((a, b) => num(b.estimatedValue) - num(a.estimatedValue))
      .slice(0, 8)
      .map((lead) => ({
        id: lead.id,
        title: lead.title,
        name: lead.name,
        status: lead.status,
        source: lead.source,
        value: num(lead.estimatedValue),
        owner: personName(lead.owner),
      }));

    const recentWins = [...leads]
      .filter((lead) => lead.status === 'WON')
      .sort(
        (a, b) =>
          (b.convertedAt ?? b.updatedAt).getTime() -
          (a.convertedAt ?? a.updatedAt).getTime(),
      )
      .slice(0, 8)
      .map((lead) => ({
        id: lead.id,
        title: lead.title,
        name: lead.name,
        value: num(lead.estimatedValue),
        at: (lead.convertedAt ?? lead.updatedAt).toISOString(),
        owner: personName(lead.owner),
      }));

    const topOpenDeals = [...deals]
      .filter((deal) => OPEN_DEAL_STATUSES.includes(deal.status))
      .sort((a, b) => num(b.amount) - num(a.amount))
      .slice(0, 8)
      .map((deal) => ({
        id: deal.id,
        title: deal.title,
        status: deal.status,
        amount: num(deal.amount),
        expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
        owner: personName(deal.owner),
      }));

    const leadsCreated = leads.filter((lead) => lead.createdAt >= since).length;
    const leadsWonInPeriod = leads.filter((lead) => {
      if (lead.status !== 'WON') return false;
      return (lead.convertedAt ?? lead.updatedAt) >= since;
    }).length;
    const leadsLostInPeriod = leads.filter(
      (lead) => lead.status === 'LOST' && lead.updatedAt >= since,
    ).length;
    const dealsCreated = deals.filter((deal) => deal.createdAt >= since).length;
    const dealsWonInPeriod = deals.filter(
      (deal) => deal.status === 'WON' && deal.updatedAt >= since,
    ).length;

    return {
      periodDays,
      since: since.toISOString(),
      leadsByStatus: leadsByStatusCounts,
      leadsByStatusRows: Object.entries(leadsByStatusCounts).map(([status, count]) => ({
        status,
        label: LEAD_STATUS_LABELS[status] ?? status,
        count,
        value: leadsByStatusValue[status] ?? 0,
      })),
      totalLeads,
      openLeads,
      convertedLeads,
      lostLeads,
      conversionRate:
        totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
      winRate:
        convertedLeads + lostLeads > 0
          ? Math.round((convertedLeads / (convertedLeads + lostLeads)) * 1000) / 10
          : 0,
      estimatedOpenValue,
      dealsByStatus: dealsByStatusCounts,
      dealsByStatusRows: Object.entries(dealsByStatusCounts).map(([status, row]) => ({
        status,
        label: DEAL_STATUS_LABELS[status] ?? status,
        count: row.count,
        amount: row.amount,
      })),
      pipelineValue,
      weightedPipeline: Math.round(weightedPipeline),
      wonDealValue,
      closingSoon,
      clientsByType,
      activeClients,
      contactCount,
      organizationCount,
      leadsBySource: Object.entries(leadsBySource).map(([source, count]) => ({
        source,
        count,
      })),
      funnel,
      leadSankey,
      dealSankey,
      trend,
      owners,
      lostReasons: Object.entries(lostReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      tasksByStatus: Object.entries(tasksByStatus).map(([status, count]) => ({
        status,
        count: Number(count),
      })),
      openTasks,
      overdueTasks,
      notesInPeriod,
      activityByType: activityGroups.map((group) => ({
        type: group.type,
        count: asCount(group._count),
      })),
      period: {
        leadsCreated,
        leadsWon: leadsWonInPeriod,
        leadsLost: leadsLostInPeriod,
        dealsCreated,
        dealsWon: dealsWonInPeriod,
        notes: notesInPeriod,
        activities: activityGroups.reduce((sum, group) => sum + asCount(group._count), 0),
      },
      topOpenLeads,
      topOpenDeals,
      recentWins,
    };
  }
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asCount(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && '_all' in value) {
    return Number((value as { _all?: number })._all ?? 0);
  }
  return Number(value ?? 0);
}

function personName(user?: { firstName: string; lastName: string } | null) {
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return name || 'Unassigned';
}

function parseStatusChange(body: string) {
  const match = STATUS_CHANGE_RE.exec(body || '');
  if (!match) return null;
  return { from: match[1].toUpperCase(), to: match[2].toUpperCase() };
}

function buildSankey(
  transitions: Array<{ from: string; to: string }>,
  currentCounts: Record<string, number>,
  labels: Record<string, string>,
) {
  const linkCounts = new Map<string, number>();
  const add = (from: string, to: string, value = 1) => {
    if (!from || !to || from === to || value <= 0) return;
    const key = `${from}\0${to}`;
    linkCounts.set(key, (linkCounts.get(key) ?? 0) + value);
  };

  for (const row of transitions) add(row.from, row.to);

  if (linkCounts.size === 0) {
    for (const [status, count] of Object.entries(currentCounts)) {
      if (count > 0) add('Created', status, count);
    }
  }

  const names: string[] = [];
  const indexOf = (raw: string) => {
    const name = raw === 'Created' ? 'Created' : (labels[raw] ?? raw);
    const existing = names.indexOf(name);
    if (existing >= 0) return existing;
    names.push(name);
    return names.length - 1;
  };

  const links = [...linkCounts.entries()]
    .map(([key, value]) => {
      const [from, to] = key.split('\0');
      return { source: indexOf(from), target: indexOf(to), value };
    })
    .filter((link) => link.source !== link.target && link.value > 0);

  return {
    nodes: names.map((name) => ({ name })),
    links,
  };
}

function buildTrend(
  leads: Array<{
    status: string;
    createdAt: Date;
    updatedAt: Date;
    convertedAt: Date | null;
  }>,
  days: number,
) {
  const buckets = new Map<string, { date: string; created: number; won: number; lost: number }>();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(start);
    day.setDate(start.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    buckets.set(key, { date: key, created: 0, won: 0, lost: 0 });
  }

  const bump = (when: Date, field: 'created' | 'won' | 'lost') => {
    const key = new Date(when).toISOString().slice(0, 10);
    const row = buckets.get(key);
    if (row) row[field] += 1;
  };

  for (const lead of leads) {
    bump(lead.createdAt, 'created');
    if (lead.status === 'WON') bump(lead.convertedAt ?? lead.updatedAt, 'won');
    if (lead.status === 'LOST') bump(lead.updatedAt, 'lost');
  }

  return [...buckets.values()];
}

function buildOwners(
  leads: Array<{
    status: string;
    ownerId: string | null;
    estimatedValue: unknown;
    owner: { firstName: string; lastName: string } | null;
  }>,
  deals: Array<{
    status: string;
    ownerId: string | null;
    amount: unknown;
    owner: { firstName: string; lastName: string } | null;
  }>,
) {
  const rows = new Map<
    string,
    {
      id: string;
      name: string;
      leads: number;
      openLeads: number;
      wonLeads: number;
      deals: number;
      pipeline: number;
      wonValue: number;
    }
  >();

  const ensure = (
    id: string | null,
    owner: { firstName: string; lastName: string } | null,
  ) => {
    const key = id ?? 'unassigned';
    const existing = rows.get(key);
    if (existing) return existing;
    const created = {
      id: key,
      name: personName(owner),
      leads: 0,
      openLeads: 0,
      wonLeads: 0,
      deals: 0,
      pipeline: 0,
      wonValue: 0,
    };
    rows.set(key, created);
    return created;
  };

  for (const lead of leads) {
    const row = ensure(lead.ownerId, lead.owner);
    row.leads += 1;
    if (OPEN_LEAD_STATUSES.includes(lead.status)) {
      row.openLeads += 1;
      row.pipeline += num(lead.estimatedValue);
    }
    if (lead.status === 'WON') row.wonLeads += 1;
  }

  for (const deal of deals) {
    const row = ensure(deal.ownerId, deal.owner);
    row.deals += 1;
    if (OPEN_DEAL_STATUSES.includes(deal.status)) row.pipeline += num(deal.amount);
    if (deal.status === 'WON') row.wonValue += num(deal.amount);
  }

  return [...rows.values()].sort((a, b) => b.pipeline - a.pipeline || b.leads - a.leads);
}

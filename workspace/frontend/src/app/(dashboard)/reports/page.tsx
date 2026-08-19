"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calendar,
  Download,
  Handshake,
  Target,
  Users,
  Briefcase,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  DEAL_STATUSES,
  DEAL_STATUS_CHART_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_CHART_COLORS,
} from "@/components/crm/crm-constants";
import { CrmFunnel, CrmSankeyDiagram, type SankeyData } from "@/components/crm/CrmSankeyDiagram";

type StatusRow = { status: string; label: string; count: number; value?: number; amount?: number };
type NamedCount = { source?: string; type?: string; status?: string; reason?: string; count: number };
type OwnerRow = {
  id: string;
  name: string;
  leads: number;
  openLeads: number;
  wonLeads: number;
  deals: number;
  pipeline: number;
  wonValue: number;
};
type LeadRow = {
  id: string;
  title: string;
  name: string;
  status?: string;
  source?: string;
  value: number;
  owner: string;
  at?: string;
};
type DealRow = {
  id: string;
  title: string;
  status: string;
  amount: number;
  expectedCloseDate: string | null;
  owner: string;
};

type CrmReport = {
  totalLeads?: number;
  openLeads?: number;
  convertedLeads?: number;
  lostLeads?: number;
  conversionRate?: number;
  winRate?: number;
  estimatedOpenValue?: number;
  pipelineValue?: number;
  weightedPipeline?: number;
  wonDealValue?: number;
  closingSoon?: number;
  activeClients?: number;
  contactCount?: number;
  organizationCount?: number;
  clientsByType?: Record<string, number>;
  leadsByStatus?: Record<string, number>;
  leadsByStatusRows?: StatusRow[];
  dealsByStatusRows?: StatusRow[];
  leadsBySource?: NamedCount[];
  funnel?: Array<{ label: string; count: number; conversionFromPrevious?: number }>;
  leadSankey?: SankeyData;
  dealSankey?: SankeyData;
  trend?: Array<{ date: string; created: number; won: number; lost: number }>;
  owners?: OwnerRow[];
  lostReasons?: NamedCount[];
  tasksByStatus?: NamedCount[];
  openTasks?: number;
  overdueTasks?: number;
  activityByType?: NamedCount[];
  period?: {
    leadsCreated?: number;
    leadsWon?: number;
    leadsLost?: number;
    dealsCreated?: number;
    dealsWon?: number;
    notes?: number;
    activities?: number;
  };
  topOpenLeads?: LeadRow[];
  topOpenDeals?: DealRow[];
  recentWins?: LeadRow[];
};

type ProjectRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  issueCount: number;
  memberCount: number;
  onTrack?: number;
  atRisk?: number;
  blocked?: number;
  done?: number;
};

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

function money(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function unwrap<T>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const root = raw as Record<string, unknown>;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as T;
  }
  return raw as T;
}

function leadLabel(status: string) {
  return LEAD_STATUSES.find((row) => row.key === status)?.label ?? status;
}

function dealLabel(status: string) {
  return DEAL_STATUSES.find((row) => row.key === status)?.label ?? status;
}

function sourceLabel(source: string) {
  return LEAD_SOURCE_LABELS[source] ?? source.replaceAll("_", " ");
}

function exportCrm(crm: CrmReport, days: number) {
  const lines = [
    ["CRM report", days === 0 ? "All time" : `Last ${days} days`],
    ["Total leads", crm.totalLeads ?? 0],
    ["Open leads", crm.openLeads ?? 0],
    ["Won leads", crm.convertedLeads ?? 0],
    ["Lost leads", crm.lostLeads ?? 0],
    ["Conversion rate %", crm.conversionRate ?? 0],
    ["Win rate %", crm.winRate ?? 0],
    ["Lead pipeline value", crm.estimatedOpenValue ?? 0],
    ["Deal pipeline value", crm.pipelineValue ?? 0],
    ["Weighted pipeline", crm.weightedPipeline ?? 0],
    ["Won deal value", crm.wonDealValue ?? 0],
    ["Active clients", crm.activeClients ?? 0],
    ["Contacts", crm.contactCount ?? 0],
    ["Organizations", crm.organizationCount ?? 0],
    ["Open tasks", crm.openTasks ?? 0],
    ["Overdue tasks", crm.overdueTasks ?? 0],
    [],
    ["Lead status", "Count", "Value"],
    ...(crm.leadsByStatusRows ?? []).map((row) => [row.label, row.count, row.value ?? 0]),
    [],
    ["Deal status", "Count", "Amount"],
    ...(crm.dealsByStatusRows ?? []).map((row) => [row.label, row.count, row.amount ?? 0]),
  ];
  const csv = lines
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `crm-report-${days || "all"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [days, setDays] = useState("30");
  const periodDays = Number(days);

  const { data: crmRes, isLoading: crmLoading } = useQuery({
    queryKey: ["reports", "crm", periodDays],
    queryFn: () => reportsApi.crm(periodDays),
    retry: false,
  });

  const { data: projectRes, isLoading: projectLoading } = useQuery({
    queryKey: ["reports", "projects"],
    queryFn: () => reportsApi.projects(),
    retry: false,
  });

  const crm = unwrap<CrmReport>(crmRes?.data) ?? {};
  const projects: ProjectRow[] = (() => {
    const raw = unwrap<unknown>(projectRes?.data);
    return Array.isArray(raw) ? (raw as ProjectRow[]) : [];
  })();

  const leadsByStatus: StatusRow[] = (crm.leadsByStatusRows?.length
    ? crm.leadsByStatusRows
    : Object.entries(crm.leadsByStatus ?? {}).map(([status, count]) => ({
        status,
        label: leadLabel(status),
        count,
        value: 0,
      }))
  ).sort(
    (a, b) =>
      LEAD_STATUSES.findIndex((row) => row.key === a.status) -
      LEAD_STATUSES.findIndex((row) => row.key === b.status),
  );

  const dealsByStatus = (crm.dealsByStatusRows ?? []).sort(
    (a, b) =>
      DEAL_STATUSES.findIndex((row) => row.key === a.status) -
      DEAL_STATUSES.findIndex((row) => row.key === b.status),
  );

  const sourceData = (crm.leadsBySource ?? []).map((row) => ({
    name: sourceLabel(row.source ?? ""),
    count: row.count,
  }));

  const projectHealth = projects.map((project) => ({
    project: project.key || project.name,
    onTrack: project.onTrack ?? 0,
    atRisk: project.atRisk ?? 0,
    blocked: project.blocked ?? 0,
    done: project.done ?? 0,
  }));

  const hasCrm =
    (crm.totalLeads ?? 0) > 0 ||
    (crm.pipelineValue ?? 0) > 0 ||
    leadsByStatus.some((row) => row.count > 0);

  const kpis = [
    { label: "Total leads", value: String(crm.totalLeads ?? 0), hint: `${crm.openLeads ?? 0} open`, icon: Target },
    { label: "Won / conversion", value: `${crm.conversionRate ?? 0}%`, hint: `${crm.convertedLeads ?? 0} won · ${crm.winRate ?? 0}% win rate`, icon: Target },
    { label: "Deal pipeline", value: money(crm.pipelineValue ?? 0), hint: `${money(crm.weightedPipeline ?? 0)} weighted`, icon: Handshake },
    { label: "Clients & people", value: String(crm.activeClients ?? 0), hint: `${crm.contactCount ?? 0} contacts · ${crm.organizationCount ?? 0} orgs`, icon: Users },
    { label: "Lead value in play", value: money(crm.estimatedOpenValue ?? 0), hint: `${crm.lostLeads ?? 0} lost leads`, icon: Briefcase },
    { label: "Won deal value", value: money(crm.wonDealValue ?? 0), hint: `${crm.closingSoon ?? 0} deals closing in 14 days`, icon: Handshake },
    { label: "CRM tasks", value: String(crm.openTasks ?? 0), hint: `${crm.overdueTasks ?? 0} overdue`, icon: CheckSquare },
    { label: "This period", value: String(crm.period?.leadsCreated ?? 0), hint: `${crm.period?.leadsWon ?? 0} won · ${crm.period?.activities ?? 0} activities`, icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            How leads, deals, and CRM work are moving
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-40">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!hasCrm} onClick={() => exportCrm(crm, periodDays)}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {crmLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <Card key={kpi.label}>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5">
                      <kpi.icon className="h-3.5 w-3.5" /> {kpi.label}
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">{kpi.hint}</CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead flow</CardTitle>
                <CardDescription>
                  Sankey of status movement. If no moves are logged, this shows where leads sit now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrmSankeyDiagram data={crm.leadSankey} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Conversion funnel</CardTitle>
                <CardDescription>Leads that reached each stage, excluding lost</CardDescription>
              </CardHeader>
              <CardContent>
                {(crm.funnel ?? []).length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No funnel data yet</p>
                ) : (
                  <CrmFunnel stages={crm.funnel ?? []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lead activity over time</CardTitle>
              <CardDescription>Created, won, and lost in the selected window</CardDescription>
            </CardHeader>
            <CardContent>
              {(crm.trend ?? []).every((row) => row.created + row.won + row.lost === 0) ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No lead movement in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={crm.trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} minTickGap={24} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="created" name="Created" stroke="#0f6661" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="won" name="Won" stroke="#0f766e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="lost" name="Lost" stroke="#b42318" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leads by status</CardTitle>
                <CardDescription>Current pipeline, with estimated value</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsByStatus.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No lead data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={leadsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                        {leadsByStatus.map((row) => (
                          <Cell key={row.status} fill={LEAD_STATUS_CHART_COLORS[row.status] ?? "#0f6661"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {leadsByStatus.length > 0 && (
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsByStatus.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(row.value ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deals by stage</CardTitle>
                <CardDescription>Open value versus won and lost</CardDescription>
              </CardHeader>
              <CardContent>
                {dealsByStatus.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No deals yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dealsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) =>
                          name === "amount" ? money(Number(value)) : Number(value)
                        }
                      />
                      <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
                        {dealsByStatus.map((row) => (
                          <Cell key={row.status} fill={DEAL_STATUS_CHART_COLORS[row.status] ?? "#0f6661"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Deal flow</p>
                  <CrmSankeyDiagram
                    data={crm.dealSankey}
                    emptyLabel="Deal movement will appear after stage changes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead sources</CardTitle>
                <CardDescription>Where current leads came from</CardDescription>
              </CardHeader>
              <CardContent>
                {sourceData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No source data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="count" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                        {sourceData.map((row, index) => (
                          <Cell
                            key={row.name}
                            fill={["#0f6661", "#b8844f", "#2f5d5a", "#c9a66b", "#0f766e", "#57534e", "#44403c", "#a8a29e"][index % 8]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lost reasons</CardTitle>
                <CardDescription>Leads and deals marked lost</CardDescription>
              </CardHeader>
              <CardContent>
                {(crm.lostReasons ?? []).length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No lost reasons recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(crm.lostReasons ?? []).map((row) => (
                        <TableRow key={row.reason}>
                          <TableCell>{row.reason}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Highest-value open leads</CardTitle>
                <CardDescription>Work these next</CardDescription>
              </CardHeader>
              <CardContent>
                <RecordTable
                  empty="No open leads"
                  rows={crm.topOpenLeads ?? []}
                  href={(row) => `/leads/${row.id}`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open deals</CardTitle>
                <CardDescription>Largest amounts still in play</CardDescription>
              </CardHeader>
              <CardContent>
                {(crm.topOpenDeals ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No open deals</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(crm.topOpenDeals ?? []).map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell>
                            <Link href={`/deals/${deal.id}`} className="font-medium hover:underline">
                              {deal.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">{deal.owner}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{dealLabel(deal.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(deal.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent wins</CardTitle>
              <CardDescription>Leads converted to clients</CardDescription>
            </CardHeader>
            <CardContent>
              {(crm.recentWins ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No conversions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Won</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(crm.recentWins ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link href={`/leads/${row.id}`} className="font-medium hover:underline">
                            {row.title || row.name}
                          </Link>
                        </TableCell>
                        <TableCell>{row.owner}</TableCell>
                        <TableCell>{row.at ? formatDate(row.at) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open CRM tasks</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{crm.openTasks ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Overdue
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{crm.overdueTasks ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Notes this period</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{crm.period?.notes ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tasks by status</CardTitle>
              </CardHeader>
              <CardContent>
                {(crm.tasksByStatus ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No CRM tasks yet</p>
                ) : (
                  <Table>
                    <TableBody>
                      {(crm.tasksByStatus ?? []).map((row) => (
                        <TableRow key={row.status}>
                          <TableCell className="capitalize">
                            {String(row.status ?? "").replaceAll("_", " ").toLowerCase()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity this period</CardTitle>
                <CardDescription>Calls, notes, status changes, and messages</CardDescription>
              </CardHeader>
              <CardContent>
                {(crm.activityByType ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No CRM activity in this window</p>
                ) : (
                  <Table>
                    <TableBody>
                      {(crm.activityByType ?? []).map((row) => (
                        <TableRow key={row.type}>
                          <TableCell className="capitalize">
                            {String(row.type ?? "").replaceAll("_", " ").toLowerCase()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Owner workload</CardTitle>
              <CardDescription>Who owns pipeline value and conversions</CardDescription>
            </CardHeader>
            <CardContent>
              {(crm.owners ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No owners assigned yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Won</TableHead>
                      <TableHead className="text-right">Deals</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(crm.owners ?? []).map((owner) => (
                      <TableRow key={owner.id}>
                        <TableCell className="font-medium">{owner.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{owner.leads}</TableCell>
                        <TableCell className="text-right tabular-nums">{owner.openLeads}</TableCell>
                        <TableCell className="text-right tabular-nums">{owner.wonLeads}</TableCell>
                        <TableCell className="text-right tabular-nums">{owner.deals}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(owner.pipeline)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-4">
          {projectLoading ? (
            <Skeleton className="h-72" />
          ) : projectHealth.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Project health appears once projects have tracked tasks.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Project health</CardTitle>
                  <CardDescription>Task mix across projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectHealth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="project" />
                      <YAxis allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                      <Bar dataKey="onTrack" name="On track" stackId="a" fill="#0f6661" />
                      <Bar dataKey="atRisk" name="At risk" stackId="a" fill="#b8844f" />
                      <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#b42318" />
                      <Bar dataKey="done" name="Done" stackId="a" fill="#a8a29e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Tasks</TableHead>
                        <TableHead className="text-right">Team</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                              {project.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{project.key}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{project.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{project.issueCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{project.memberCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecordTable({
  rows,
  empty,
  href,
}: {
  rows: LeadRow[];
  empty: string;
  href: (row: LeadRow) => string;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={href(row)} className="font-medium hover:underline">
                {row.title || row.name}
              </Link>
              <p className="text-xs text-muted-foreground">{row.owner}</p>
            </TableCell>
            <TableCell>
              {row.status ? <Badge variant="secondary">{leadLabel(row.status)}</Badge> : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{money(row.value)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

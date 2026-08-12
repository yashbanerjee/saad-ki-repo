"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Bug,
  CheckCircle2,
  TrendingUp,
  Activity,
  Clock,
  Calendar,
  FileText,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { dashboardApi } from "@/lib/api";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { useAuthStore, isClientUser } from "@/lib/auth-store";

const STAT_LABELS = [
  { label: "Active Projects", icon: FolderKanban },
  { label: "Open Tasks", icon: CheckCircle2 },
  { label: "Open Bugs", icon: Bug },
  { label: "Avg. Velocity", icon: TrendingUp },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

interface DashboardStat {
  label: string;
  value: string;
  change?: string;
}

interface ActivityItem {
  id: string;
  action: string;
  target: string;
  user: string;
  time: string;
}

interface ProjectProgressRow {
  id: string;
  name: string;
  key?: string;
  status?: string;
  dueDate?: string | null;
  progress: number;
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  todoTasks?: number;
}

function unwrapStatsPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data) || n.projectReport || n.projectProgress) {
      return n;
    }
  }
  return root;
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);

  useEffect(() => {
    if (isClient) {
      router.replace("/client-portal");
    }
  }, [isClient, router]);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats(),
    retry: false,
    enabled: !isClient,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => dashboardApi.activity(),
    retry: false,
    enabled: !isClient,
  });

  const payload = useMemo(
    () => unwrapStatsPayload(statsData?.data) ?? {},
    [statsData],
  );

  const stats: DashboardStat[] = useMemo(() => {
    const list = Array.isArray(payload.data) ? payload.data : [];
    if (list.length > 0) return list as DashboardStat[];
    return STAT_LABELS.map((s) => ({ label: s.label, value: "0" }));
  }, [payload]);

  const projectProgress: ProjectProgressRow[] = useMemo(() => {
    const rows = Array.isArray(payload.projectProgress)
      ? payload.projectProgress
      : [];
    return rows as ProjectProgressRow[];
  }, [payload]);

  const projectReport = useMemo(() => {
    const raw =
      payload.projectReport && typeof payload.projectReport === "object"
        ? (payload.projectReport as Record<string, unknown>)
        : {};
    return {
      overallProgress: Number(raw.overallProgress ?? 0),
      totalProjects: Number(raw.totalProjects ?? 0),
      totalTasks: Number(raw.totalTasks ?? 0),
      doneTasks: Number(raw.doneTasks ?? 0),
      inProgressTasks: Number(raw.inProgressTasks ?? 0),
      todoTasks: Number(raw.todoTasks ?? 0),
      byProject: Array.isArray(raw.byProject)
        ? (raw.byProject as {
            name: string;
            fullName?: string;
            id: string;
            progress: number;
            done: number;
            total: number;
          }[])
        : [],
    };
  }, [payload]);

  const statusData: { name: string; value: number; color: string }[] = useMemo(() => {
    return Array.isArray(payload.distribution)
      ? (payload.distribution as { name: string; value: number; color: string }[])
      : [];
  }, [payload]);

  if (isClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <Skeleton className="h-40 w-full max-w-lg" />
      </div>
    );
  }

  const rawActivity = activityData?.data?.data ?? activityData?.data ?? [];
  const activity: ActivityItem[] = Array.isArray(rawActivity) ? rawActivity : [];
  const reportBars = projectReport.byProject;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const overallPct = projectReport.overallProgress;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.section
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/80 to-transparent p-6 md:p-8 dark:border-white/8 dark:from-white/[0.06]"
      >
        <div className="pointer-events-none absolute inset-0 mesh-vedha opacity-60" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-3">
            <Badge variant="gold" className="mb-1">
              Vedha ecosystem
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Good evening, {firstName}.
            </h1>
            <p className="text-muted-foreground">
              Track project progress and overall delivery across your workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/projects">
                New project <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/onboarding">
                <ClipboardList className="h-4 w-4" />
                Client onboarding
              </Link>
            </Button>
          </div>
        </div>
      </motion.section>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat, i) => {
              const Icon = STAT_LABELS[i]?.icon || Activity;
              return (
                <Card key={stat.label} className="group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</p>
                        {stat.change && (
                          <Badge
                            variant={stat.change.startsWith("+") ? "success" : "secondary"}
                            className="mt-3"
                          >
                            {stat.change}
                          </Badge>
                        )}
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 transition group-hover:border-vedha-teal/30 group-hover:shadow-glow dark:border-white/8 dark:bg-white/[0.04] dark:group-hover:border-vedha-cyan/30">
                        <Icon className="h-5 w-5 text-vedha-cyan" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </motion.div>

      {/* Overall project report graph */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Overall project report</CardTitle>
              <CardDescription>
                Completion % by project · {projectReport.doneTasks ?? 0} of{" "}
                {projectReport.totalTasks ?? 0} tasks done across{" "}
                {projectReport.totalProjects ?? 0} projects
              </CardDescription>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-center dark:border-white/8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Workspace progress
              </p>
              <p className="text-2xl font-bold text-vedha-teal dark:text-vedha-cyan">
                {overallPct}%
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : reportBars.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No project data yet — create a project and add tasks to see the report.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, reportBars.length * 36)}>
                <BarChart
                  data={reportBars}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number, _name, props) => {
                      const row = props?.payload as {
                        done?: number;
                        total?: number;
                        fullName?: string;
                      };
                      return [
                        `${value}% (${row?.done ?? 0}/${row?.total ?? 0} tasks)`,
                        row?.fullName || "Progress",
                      ];
                    }}
                    contentStyle={{
                      background: "rgba(17,24,39,0.92)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar
                    dataKey="progress"
                    name="Progress"
                    fill="#0f6661"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div variants={item} className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-vedha-cyan" />
                  Project progress
                </CardTitle>
                <CardDescription>Progress based on completed board tasks</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : projectProgress.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No projects"
                  description="Create a project to see progress here."
                  actionLabel="New project"
                  actionHref="/projects"
                  className="py-10"
                />
              ) : (
                <div className="space-y-4">
                  {projectProgress.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-vedha-teal/30 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-vedha-cyan/20"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.doneTasks ?? 0}/{p.totalTasks ?? 0} tasks done
                            {typeof p.inProgressTasks === "number"
                              ? ` · ${p.inProgressTasks} in progress`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {p.progress ?? 0}%
                          </span>
                          {p.status && (
                            <Badge variant={p.status === "ACTIVE" ? "success" : "secondary"}>
                              {String(p.status).replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted dark:bg-white/5">
                        <div
                          className="h-full rounded-full gradient-vedha transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, p.progress ?? 0))}%` }}
                        />
                      </div>
                      {p.dueDate && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> Due {formatDate(p.dueDate)}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Task distribution</CardTitle>
              <CardDescription>All projects · by status</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : statusData.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  No task data yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(17,24,39,0.92)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12,
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {statusData.map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-vedha-gold" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Activity from your team will show up here."
                className="py-10"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activity.map((row) => (
                  <div key={row.id} className="flex gap-3 text-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 dark:border-white/8 dark:bg-white/[0.04]">
                      <Clock className="h-3.5 w-3.5 text-vedha-cyan" />
                    </div>
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium">{row.user}</span>{" "}
                        <span className="text-muted-foreground">{row.action}</span>
                      </p>
                      <p className="truncate text-muted-foreground">{row.target}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {formatRelativeTime(row.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/documents", icon: FileText, label: "Documents" },
          { href: "/onboarding", icon: ClipboardList, label: "Client onboarding" },
          { href: "/issues", icon: Bug, label: "Issues" },
          { href: "/nda", icon: FileText, label: "NDA templates" },
        ].map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="h-full transition hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/50 dark:border-white/8 dark:bg-white/[0.04]">
                  <q.icon className="h-4 w-4 text-vedha-cyan" />
                </div>
                <p className="text-sm font-medium">{q.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>
    </motion.div>
  );
}

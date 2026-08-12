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
  AreaChart,
  Area,
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
  status?: string;
  dueDate?: string | null;
  progress: number;
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
}

function unwrapStatsPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data) || n.projectReport || n.sprintProgress) {
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
    queryKey: ["dashboard-activity", 5],
    queryFn: () => dashboardApi.activity(5),
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
    return Array.isArray(payload.projectProgress)
      ? (payload.projectProgress as ProjectProgressRow[])
      : [];
  }, [payload]);

  const sprintProgress = useMemo(() => {
    const raw =
      payload.sprintProgress && typeof payload.sprintProgress === "object"
        ? (payload.sprintProgress as Record<string, unknown>)
        : {};
    return {
      hasActiveSprint: Boolean(raw.hasActiveSprint),
      sprintName: (raw.sprintName as string) || null,
      projectName: (raw.projectName as string) || null,
      totalTasks: Number(raw.totalTasks ?? 0),
      completedTasks: Number(raw.completedTasks ?? 0),
      progressPercent: Number(raw.progressPercent ?? 0),
      message: (raw.message as string) || undefined,
    };
  }, [payload]);

  const avgVelocityMeta = useMemo(() => {
    const raw =
      payload.avgVelocity && typeof payload.avgVelocity === "object"
        ? (payload.avgVelocity as Record<string, unknown>)
        : {};
    return {
      unit: (raw.unit as string) || "tasks",
      completedSprints: Number(raw.completedSprints ?? 0),
      message: (raw.message as string) || undefined,
    };
  }, [payload]);

  const velocityData: { week: string; tasks: number; bugs: number }[] =
    useMemo(() => {
      return Array.isArray(payload.velocity)
        ? (payload.velocity as { week: string; tasks: number; bugs: number }[])
        : [];
    }, [payload]);

  const statusData: { name: string; value: number; color: string }[] =
    useMemo(() => {
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
  const activity: ActivityItem[] = (
    Array.isArray(rawActivity) ? rawActivity : []
  ).slice(0, 5);
  const firstName = user?.name?.split(" ")[0] ?? "there";

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
              Your workspace overview. Track projects, issues, and team activity.
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
              const isVelocity = stat.label === "Avg. Velocity";
              return (
                <Card key={stat.label} className="group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</p>
                        {isVelocity && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {avgVelocityMeta.message
                              ? avgVelocityMeta.message
                              : avgVelocityMeta.unit === "story_points"
                                ? `Avg story points / completed sprint (${avgVelocityMeta.completedSprints})`
                                : `Avg completed tasks / completed sprint (${avgVelocityMeta.completedSprints})`}
                          </p>
                        )}
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 transition group-hover:border-vedha-teal/30 group-hover:shadow-glow dark:border-white/8 dark:bg-white/[0.04]">
                        <Icon className="h-5 w-5 text-vedha-cyan" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div variants={item} className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tasks completed vs bugs</CardTitle>
                <CardDescription>
                  Completed work in the last 6 weeks (Done status)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : velocityData.length === 0 ||
                velocityData.every((w) => w.tasks === 0 && w.bugs === 0) ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  No completed tasks or bugs in the last 6 weeks
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={velocityData}>
                    <defs>
                      <linearGradient id="vedhaTasks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f6661" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#0f6661" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="vedhaBugs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d4a574" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#d4a574" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
                    <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(17,24,39,0.92)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="tasks"
                      name="Completed tasks"
                      stroke="#a1c8cf"
                      fill="url(#vedhaTasks)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="bugs"
                      name="Completed bugs"
                      stroke="#d4a574"
                      fill="url(#vedhaBugs)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sprint progress</CardTitle>
              <CardDescription>
                {sprintProgress.hasActiveSprint
                  ? `${sprintProgress.sprintName || "Active sprint"}${
                      sprintProgress.projectName
                        ? ` · ${sprintProgress.projectName}`
                        : ""
                    }`
                  : "Current active sprint"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : !sprintProgress.hasActiveSprint ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active sprint
                </p>
              ) : sprintProgress.totalTasks === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No sprint tasks
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold tracking-tight">
                      {sprintProgress.progressPercent}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sprintProgress.completedTasks} / {sprintProgress.totalTasks}{" "}
                      tasks done
                    </p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted dark:bg-white/5">
                    <div
                      className="h-full rounded-full gradient-vedha transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, sprintProgress.progressPercent),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
              <CardDescription>All issues by status</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[160px] w-full" />
              ) : statusData.length === 0 ? (
                <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">
                  No issue data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
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
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="h-4 w-4 text-vedha-cyan" /> Project progress
                </CardTitle>
                <CardDescription>Based on completed board tasks</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
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
                <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
                  {projectProgress.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-vedha-teal/30 dark:border-white/8 dark:bg-white/[0.03]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.doneTasks ?? 0}/{p.totalTasks ?? 0} tasks done
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {p.progress ?? 0}%
                        </span>
                      </div>
                      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/5">
                        <div
                          className="h-full rounded-full gradient-vedha"
                          style={{
                            width: `${Math.min(100, Math.max(0, p.progress ?? 0))}%`,
                          }}
                        />
                      </div>
                      {p.dueDate && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {formatDate(p.dueDate)}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-vedha-gold" /> Recent activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/activity">See All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
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
                <div className="max-h-[320px] space-y-4 overflow-hidden">
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
      </div>

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

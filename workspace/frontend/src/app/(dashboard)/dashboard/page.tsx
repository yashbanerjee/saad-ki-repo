"use client";

import Link from "next/link";
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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { dashboardApi, projectsApi } from "@/lib/api";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";

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

interface DashboardProject {
  id: string;
  name: string;
  progress?: number;
  status?: string;
  dueDate?: string;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats(),
    retry: false,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => dashboardApi.activity(),
    retry: false,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    retry: false,
  });

  const apiStats = statsData?.data?.data ?? statsData?.data;
  const stats: DashboardStat[] =
    Array.isArray(apiStats) && apiStats.length > 0
      ? apiStats
      : Array.isArray(apiStats?.data) && apiStats.data.length > 0
        ? apiStats.data
        : STAT_LABELS.map((s) => ({ label: s.label, value: "0" }));

  const rawActivity = activityData?.data?.data ?? activityData?.data ?? [];
  const activity: ActivityItem[] = Array.isArray(rawActivity) ? rawActivity : [];
  const projects: DashboardProject[] = (() => {
    const raw = projectsData?.data?.data ?? projectsData?.data ?? [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as { data?: DashboardProject[] })?.data)) {
      return (raw as { data: DashboardProject[] }).data;
    }
    return [];
  })();

  const velocityData: { week: string; tasks: number; bugs: number }[] =
    (Array.isArray(statsData?.data?.velocity) && statsData.data.velocity) ||
    (Array.isArray(statsData?.data?.data?.velocity) && statsData.data.data.velocity) ||
    [];

  const statusData: { name: string; value: number; color: string }[] =
    (Array.isArray(statsData?.data?.distribution) && statsData.data.distribution) ||
    (Array.isArray(statsData?.data?.data?.distribution) && statsData.data.data.distribution) ||
    [];

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

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div variants={item} className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sprint progress</CardTitle>
                <CardDescription>Tasks completed vs bugs · last 6 weeks</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {velocityData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  No sprint data available
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(17,24,39,0.92)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        backdropFilter: "blur(20px)",
                      }}
                    />
                    <Area type="monotone" dataKey="tasks" stroke="#a1c8cf" fill="url(#vedhaTasks)" strokeWidth={2} />
                    <Area type="monotone" dataKey="bugs" stroke="#d4a574" fill="url(#vedhaBugs)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
              <CardDescription>Current sprint</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  No distribution data
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
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-4">
                    {statusData.map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-vedha-cyan" /> Projects
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
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
                  {projects.slice(0, 3).map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-vedha-teal/30 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-vedha-cyan/20">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{p.name}</p>
                        {p.status && (
                          <Badge variant={p.status === "active" ? "success" : "secondary"}>
                            {p.status}
                          </Badge>
                        )}
                      </div>
                      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full gradient-vedha"
                          style={{ width: `${p.progress ?? 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{p.progress ?? 0}%</span>
                        {p.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(p.dueDate)}
                          </span>
                        )}
                      </div>
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
                <div className="space-y-4">
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

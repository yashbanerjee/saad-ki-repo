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
  Users,
  FileText,
  ClipboardList,
  Sparkles,
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
import { dashboardApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";

const velocityData = [
  { week: "W1", tasks: 12, bugs: 3 },
  { week: "W2", tasks: 18, bugs: 5 },
  { week: "W3", tasks: 15, bugs: 2 },
  { week: "W4", tasks: 22, bugs: 4 },
  { week: "W5", tasks: 28, bugs: 3 },
  { week: "W6", tasks: 24, bugs: 6 },
];

const statusData = [
  { name: "Completed", value: 45, color: "#0f6661" },
  { name: "In Progress", value: 30, color: "#a1c8cf" },
  { name: "Todo", value: 25, color: "#d4a574" },
];

const defaultStats = [
  { label: "Active Projects", value: "12", change: "+2", icon: FolderKanban },
  { label: "Open Tasks", value: "84", change: "-5", icon: CheckCircle2 },
  { label: "Open Bugs", value: "7", change: "+1", icon: Bug },
  { label: "Avg. Velocity", value: "24", change: "+12%", icon: TrendingUp },
];

const defaultActivity = [
  {
    id: "1",
    action: "completed",
    target: "API integration",
    user: "James L.",
    time: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    action: "opened",
    target: "Login redirect bug",
    user: "Sarah K.",
    time: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "3",
    action: "started",
    target: "Sprint 5",
    user: "Alex M.",
    time: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "4",
    action: "onboarded",
    target: "Acme Corp",
    user: "System",
    time: new Date(Date.now() - 172800000).toISOString(),
  },
];

const projects = [
  { name: "TaskFlow Platform", progress: 72, status: "On track", due: "Aug 12" },
  { name: "Client Portal v2", progress: 41, status: "At risk", due: "Aug 28" },
  { name: "NDA Automation", progress: 88, status: "On track", due: "Jul 30" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

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

  const stats =
    statsData?.data?.data ??
    statsData?.data ??
    defaultStats.map((s) => ({ label: s.label, value: s.value, change: s.change }));

  const activity = activityData?.data?.data ?? activityData?.data ?? defaultActivity;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero */}
      <motion.section
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-transparent p-6 md:p-8"
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
              Your workspace is quiet and on track. Sprint velocity is up{" "}
              <span className="text-vedha-cyan">12%</span> this week.
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

      {/* Stats */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          : (Array.isArray(stats) ? stats : defaultStats).map(
              (stat: { label: string; value: string; change?: string }, i: number) => {
                const Icon = defaultStats[i]?.icon || Activity;
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] transition group-hover:border-vedha-cyan/30 group-hover:shadow-glow">
                          <Icon className="h-5 w-5 text-vedha-cyan" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            )}
      </motion.div>

      {/* Charts + activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div variants={item} className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sprint progress</CardTitle>
                <CardDescription>Tasks completed vs bugs · last 6 weeks</CardDescription>
              </div>
              <Badge variant="info">Live</Badge>
            </CardHeader>
            <CardContent>
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
                  <Area
                    type="monotone"
                    dataKey="tasks"
                    stroke="#a1c8cf"
                    fill="url(#vedhaTasks)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="bugs"
                    stroke="#d4a574"
                    fill="url(#vedhaBugs)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
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
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Projects, team, docs, onboarding */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <motion.div variants={item} className="xl:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-vedha-cyan" /> Projects
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.map((p) => (
                <div key={p.name} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{p.name}</p>
                    <Badge variant={p.status === "On track" ? "success" : "warning"}>
                      {p.status}
                    </Badge>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full gradient-vedha"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.progress}%</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {p.due}
                    </span>
                  </div>
                </div>
              ))}
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
            <CardContent className="space-y-4">
              {activityLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                : (Array.isArray(activity) ? activity : defaultActivity).map(
                    (row: {
                      id: string;
                      action: string;
                      target: string;
                      user: string;
                      time: string;
                    }) => (
                      <div key={row.id} className="flex gap-3 text-sm">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
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
                    )
                  )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-vedha-cyan" /> Team availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Dan Developer", status: "Available", color: "bg-emerald-400" },
                { name: "Quinn Tester", status: "In focus", color: "bg-vedha-gold" },
                { name: "Lisa Lead", status: "Meeting", color: "bg-vedha-cyan" },
              ].map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded-xl border border-white/8 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${m.color}`} />
                    <span className="text-sm">{m.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-vedha-gold" /> AI suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Move 3 backlog bugs into Sprint 1 to balance capacity.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Ask Vedha AI
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/documents", icon: FileText, label: "Recent documents", hint: "12 updated" },
          { href: "/onboarding", icon: ClipboardList, label: "Client onboarding", hint: "3 in progress" },
          { href: "/issues", icon: Bug, label: "Recent issues", hint: "7 open" },
          { href: "/nda", icon: FileText, label: "Pending NDAs", hint: "2 awaiting sign" },
        ].map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="h-full transition hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
                  <q.icon className="h-4 w-4 text-vedha-cyan" />
                </div>
                <div>
                  <p className="text-sm font-medium">{q.label}</p>
                  <p className="text-xs text-muted-foreground">{q.hint}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>
    </motion.div>
  );
}

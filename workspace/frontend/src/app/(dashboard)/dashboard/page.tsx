"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  Bug,
  CheckCircle2,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const velocityData = [
  { week: "W1", tasks: 12, bugs: 3 },
  { week: "W2", tasks: 18, bugs: 5 },
  { week: "W3", tasks: 15, bugs: 2 },
  { week: "W4", tasks: 22, bugs: 4 },
  { week: "W5", tasks: 28, bugs: 3 },
  { week: "W6", tasks: 24, bugs: 6 },
];

const statusData = [
  { name: "Completed", value: 45, color: "#14b8a6" },
  { name: "In Progress", value: 30, color: "#0ea5e9" },
  { name: "Todo", value: 25, color: "#64748b" },
];

const defaultStats = [
  { label: "Active Projects", value: "12", change: "+2", icon: FolderKanban },
  { label: "Open Tasks", value: "84", change: "-5", icon: CheckCircle2 },
  { label: "Open Bugs", value: "7", change: "+1", icon: Bug },
  { label: "Avg. Velocity", value: "24", change: "+12%", icon: TrendingUp },
];

const defaultActivity = [
  { id: "1", action: "Task completed", target: "API integration", user: "James L.", time: new Date(Date.now() - 3600000).toISOString() },
  { id: "2", action: "New issue", target: "Login redirect bug", user: "Sarah K.", time: new Date(Date.now() - 7200000).toISOString() },
  { id: "3", action: "Sprint started", target: "Sprint 5", user: "Alex M.", time: new Date(Date.now() - 86400000).toISOString() },
  { id: "4", action: "Client onboarded", target: "Acme Corp", user: "System", time: new Date(Date.now() - 172800000).toISOString() },
];

export default function DashboardPage() {
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

  const stats = statsData?.data?.data ?? statsData?.data ?? defaultStats.map((s) => ({
    label: s.label,
    value: s.value,
    change: s.change,
  }));

  const activity = activityData?.data?.data ?? activityData?.data ?? defaultActivity;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your workspace activity and metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          : (Array.isArray(stats) ? stats : defaultStats).map((stat: { label: string; value: string; change?: string }, i: number) => {
              const Icon = defaultStats[i]?.icon || Activity;
              return (
                <Card key={stat.label} className="glass-subtle">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold font-display mt-1">{stat.value}</p>
                        {stat.change && (
                          <Badge variant={stat.change.startsWith("+") ? "success" : "secondary"} className="mt-2">
                            {stat.change}
                          </Badge>
                        )}
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Velocity</CardTitle>
            <CardDescription>Tasks completed vs bugs reported per week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Area type="monotone" dataKey="tasks" stackId="1" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="bugs" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
            <CardDescription>Current sprint task breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                  {item.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="tasks" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : (Array.isArray(activity) ? activity : defaultActivity).map((item: { id: string; action: string; target: string; user: string; time: string }) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p><span className="font-medium">{item.user}</span> {item.action}</p>
                      <p className="text-muted-foreground truncate">{item.target}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(item.time)}</p>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

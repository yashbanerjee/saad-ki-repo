"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download, Calendar, BarChart3, Target, Handshake, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportsApi } from "@/lib/api";

export default function ReportsPage() {
  const { data: crmRes, isLoading: crmLoading } = useQuery({
    queryKey: ["reports", "crm"],
    queryFn: () => reportsApi.crm(),
    retry: false,
  });

  const crm = crmRes?.data?.data ?? crmRes?.data;
  const leadsByStatus = crm?.leadsByStatus
    ? Object.entries(crm.leadsByStatus as Record<string, number>).map(([status, count]) => ({
        status,
        count,
      }))
    : [];

  const burndownData: { day: string; ideal: number; actual: number }[] = [];
  const projectHealth: { project: string; onTrack: number; atRisk: number; blocked: number }[] = [];
  const hasProjectCharts = burndownData.length > 0 || projectHealth.length > 0;
  const hasCrm = !!crm && (crm.totalLeads > 0 || crm.pipelineValue > 0 || leadsByStatus.some((r) => r.count > 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">CRM and project health metrics</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30d">
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!hasCrm && !hasProjectCharts}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">CRM overview</h2>
        {crmLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Total leads
                </CardDescription>
                <CardTitle className="text-3xl">{crm?.totalLeads ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Conversion rate</CardDescription>
                <CardTitle className="text-3xl">{crm?.conversionRate ?? 0}%</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {crm?.convertedLeads ?? 0} won leads
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Handshake className="h-3.5 w-3.5" /> Pipeline value
                </CardDescription>
                <CardTitle className="text-3xl">
                  ${Number(crm?.pipelineValue ?? 0).toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Active clients
                </CardDescription>
                <CardTitle className="text-3xl">
                  {Number(crm?.clientsByType?.COMPANY ?? 0) +
                    Number(crm?.clientsByType?.INDIVIDUAL ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {crm?.clientsByType?.COMPANY ?? 0} company ·{" "}
                {crm?.clientsByType?.INDIVIDUAL ?? 0} individual
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Leads by status</CardTitle>
            <CardDescription>Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {leadsByStatus.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No lead data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={leadsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasProjectCharts ? (
        <EmptyState
          icon={BarChart3}
          title="Project charts unavailable"
          description="Sprint burndown and project health will populate once you have active sprints with tracked work."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sprint Burndown</CardTitle>
              <CardDescription>Ideal vs actual remaining work</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={burndownData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#64748b"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line type="monotone" dataKey="actual" stroke="#14b8a6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Health</CardTitle>
              <CardDescription>Task status breakdown by project</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectHealth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="project" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="onTrack" stackId="a" fill="#14b8a6" />
                  <Bar dataKey="atRisk" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="blocked" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

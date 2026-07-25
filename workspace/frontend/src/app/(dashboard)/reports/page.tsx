"use client";

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
import { Download, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReportsPage() {
  const burndownData: { day: string; ideal: number; actual: number }[] = [];
  const projectHealth: { project: string; onTrack: number; atRisk: number; blocked: number }[] = [];
  const hasData = burndownData.length > 0 || projectHealth.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analytics and project health metrics</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30d">
            <SelectTrigger className="w-36"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!hasData}><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No report data"
          description="Reports will populate once you have active projects and sprints with tracked work."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sprint Burndown</CardTitle>
              <CardDescription>Ideal vs actual remaining work</CardDescription>
            </CardHeader>
            <CardContent>
              {burndownData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No burndown data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={burndownData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend />
                    <Line type="monotone" dataKey="ideal" stroke="#64748b" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#14b8a6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Health</CardTitle>
              <CardDescription>Task status breakdown by project</CardDescription>
            </CardHeader>
            <CardContent>
              {projectHealth.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No project health data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={projectHealth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="project" />
                    <YAxis />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="onTrack" stackId="a" fill="#14b8a6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="atRisk" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="blocked" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

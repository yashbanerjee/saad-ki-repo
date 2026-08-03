"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Target, Users, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { reportsApi } from "@/lib/api";

export default function CrmHomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "crm"],
    queryFn: () => reportsApi.crm(),
    retry: false,
  });
  const crm = data?.data?.data ?? data?.data;
  const leadsByStatus = crm?.leadsByStatus
    ? Object.entries(crm.leadsByStatus as Record<string, number>).map(([status, count]) => ({
        status,
        count,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Sales workspace</h1>
          <p className="text-muted-foreground text-sm">
            Pipeline health, conversion, and quick links
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/leads">Leads</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/leads/board">Board</Link>
          </Button>
          <Button asChild>
            <Link href="/deals">Deals</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
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
              {crm?.convertedLeads ?? 0} won
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
                <Users className="h-3.5 w-3.5" /> Clients
              </CardDescription>
              <CardTitle className="text-3xl">
                {Number(crm?.clientsByType?.COMPANY ?? 0) +
                  Number(crm?.clientsByType?.INDIVIDUAL ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leads by status</CardTitle>
          <CardDescription>Current pipeline distribution</CardDescription>
        </CardHeader>
        <CardContent>
          {leadsByStatus.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/contacts", label: "Contacts", icon: Users },
          { href: "/organizations", label: "Organizations", icon: Building2 },
          { href: "/crm/tasks", label: "Tasks", icon: Target },
          { href: "/settings/integrations", label: "Integrations", icon: Handshake },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <item.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

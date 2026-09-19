"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { issuesApi, projectsApi } from "@/lib/api";

export default function SpaceReportsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: projectData, isLoading: pLoading } = useQuery({
    queryKey: ["space", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: issuesData, isLoading: iLoading } = useQuery({
    queryKey: ["issues", "space", id],
    queryFn: () => issuesApi.list({ projectId: id, limit: 100 }),
    retry: false,
  });

  const space = projectData?.data?.data ?? projectData?.data;
  const issuesRaw = issuesData?.data?.data ?? issuesData?.data ?? [];
  const issues = Array.isArray(issuesRaw) ? issuesRaw : [];

  const byStatus: Record<string, number> = {};
  for (const i of issues as Array<{ status?: string }>) {
    const s = i.status || "UNKNOWN";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  if (pLoading || iLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Space stats for <span className="font-medium text-foreground">{space?.name}</span>.{" "}
        <Link href="/reports" className="text-[#0C66E4] hover:underline">
          Open workspace reports
        </Link>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Work items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{issues.length}</p>
          </CardContent>
        </Card>
        {Object.entries(byStatus).map(([status, count]) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{status}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

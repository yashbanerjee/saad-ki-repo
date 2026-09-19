"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bug,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  LayoutGrid,
  List,
} from "lucide-react";
import { projectsApi, issuesApi, documentsApi } from "@/lib/api";
import { spaceHref } from "@/lib/space-paths";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

export default function SpaceSummaryPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: projectData, isLoading } = useQuery({
    queryKey: ["space", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: issuesData } = useQuery({
    queryKey: ["issues", "space", id],
    queryFn: () => issuesApi.list({ projectId: id, limit: 50 }),
    retry: false,
  });

  const { data: docsData } = useQuery({
    queryKey: ["documents", "space", id],
    queryFn: () => documentsApi.list({ projectId: id }),
    retry: false,
  });

  const space = projectData?.data?.data ?? projectData?.data;
  const issuesRaw = issuesData?.data?.data ?? issuesData?.data ?? [];
  const issues = Array.isArray(issuesRaw) ? issuesRaw : [];
  const docsPayload = docsData?.data?.data ?? docsData?.data ?? {};
  const docs = Array.isArray(docsPayload)
    ? docsPayload
    : Array.isArray(docsPayload.documents)
      ? docsPayload.documents
      : [];

  const openIssues = issues.filter(
    (i: { status?: string }) =>
      i.status && !["DONE", "CANCELLED", "CLOSED"].includes(i.status),
  );
  const doneIssues = issues.filter((i: { status?: string }) => i.status === "DONE");
  const updated = [...issues]
    .sort(
      (a: { updatedAt?: string }, b: { updatedAt?: string }) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    )
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-[#0C66E4] hover:bg-[#0055CC]">
          <Link href={spaceHref(id, "board")}>
            <LayoutGrid className="mr-1.5 h-4 w-4" /> Board
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={spaceHref(id, "list")}>
            <List className="mr-1.5 h-4 w-4" /> List
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={spaceHref(id, "calendar")}>
            <CalendarDays className="mr-1.5 h-4 w-4" /> Calendar
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={spaceHref(id, "docs")}>
            <FileText className="mr-1.5 h-4 w-4" /> Docs
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Open work items",
            value: openIssues.length,
            icon: Bug,
          },
          {
            label: "Completed",
            value: doneIssues.length,
            icon: CheckCircle2,
          },
          {
            label: "Documents",
            value: docs.length,
            icon: FileText,
          },
          {
            label: "Status",
            value: space?.status ?? "—",
            icon: FolderKanban,
          },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <m.icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-semibold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {updated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work items yet.</p>
            ) : (
              updated.map((issue: { id: string; key?: string; title: string; updatedAt?: string }) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm transition hover:bg-muted/50"
                >
                  <span className="truncate font-medium">
                    {issue.key ? `${issue.key}: ` : ""}
                    {issue.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {issue.updatedAt ? formatRelativeTime(issue.updatedAt) : ""}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">About this space</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{space?.description || "No description."}</p>
            {space?.endDate && (
              <p>
                Target date:{" "}
                <span className="text-foreground">
                  {new Date(space.endDate).toLocaleDateString()}
                </span>
              </p>
            )}
            <p>
              Members:{" "}
              <span className="text-foreground">
                {space?.members?.length ?? space?._count?.members ?? "—"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

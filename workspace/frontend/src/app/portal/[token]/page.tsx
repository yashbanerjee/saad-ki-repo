"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  ExternalLink,
  Layers,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { portalApi } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

const MILESTONE_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const TASK_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "Doing",
  DONE: "Done",
};

const ISSUE_STATUS_ORDER = [
  "TODO",
  "IN_PROGRESS",
  "TESTING",
  "CODE_REVIEW",
  "READY_FOR_QA",
  "QA_FAILED",
  "READY_FOR_RELEASE",
  "DONE",
  "BLOCKED",
];

const ISSUE_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  TESTING: "Testing",
  CODE_REVIEW: "Code review",
  READY_FOR_QA: "Ready for QA",
  QA_FAILED: "QA failed",
  READY_FOR_RELEASE: "Ready for release",
  DONE: "Done",
  BLOCKED: "Blocked",
  CUSTOM: "Other",
};

type PortalIssue = {
  id: string;
  key: string;
  title: string;
  type?: string;
  priority?: string;
  status?: string;
  milestone?: { name: string } | null;
};

export default function PublicPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => portalApi.get(token),
    retry: false,
  });

  const portal = data?.data?.data ?? data?.data ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Skeleton className="h-96 w-full max-w-3xl" />
      </div>
    );
  }

  if (isError || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <EmptyState
          title="Link not found"
          description="This project link is invalid or has been turned off. Ask your vendor for a new link."
        />
      </div>
    );
  }

  const progress = portal.progressPercent ?? 0;
  const milestones = portal.milestones ?? [];
  const tasks = portal.tasks ?? [];
  const issues: PortalIssue[] = portal.issues ?? [];
  const documents = portal.documents ?? [];
  const boardByStatus = (portal.boardByStatus ?? {}) as Record<
    string,
    PortalIssue[]
  >;
  const statusKeys = [
    ...ISSUE_STATUS_ORDER.filter((s) => (boardByStatus[s]?.length ?? 0) > 0),
    ...Object.keys(boardByStatus).filter((s) => !ISSUE_STATUS_ORDER.includes(s)),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary min-w-0">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">{portal.companyName || "TaskFlow by Vedha"}</span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Public project view · No login
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {portal.projectKey && (
              <Badge variant="outline" className="font-mono">
                {portal.projectKey}
              </Badge>
            )}
            {portal.status && <Badge variant="success">{portal.status}</Badge>}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {portal.projectName}
          </h1>
          {portal.clientName && (
            <p className="text-muted-foreground">Prepared for {portal.clientName}</p>
          )}
          {portal.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap max-w-2xl pt-1">
              {portal.description}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overall progress</CardTitle>
              <CardDescription>
                {portal.taskCounts?.total
                  ? `${portal.taskCounts.done ?? 0} of ${portal.taskCounts.total} client tasks done`
                  : portal.issueCounts?.total
                    ? `${portal.issueCounts.done ?? 0} of ${portal.issueCounts.total} work items done`
                    : "Progress updates as work is completed"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-display font-bold text-primary mb-3">{progress}%</p>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Start: </span>
                {portal.startDate ? formatDate(portal.startDate) : "Not set"}
              </p>
              <p>
                <span className="text-muted-foreground">End: </span>
                {portal.endDate ? formatDate(portal.endDate) : "Not set"}
              </p>
              {portal.daysRemaining != null && (
                <p className="pt-1">
                  {portal.daysRemaining >= 0 ? (
                    <Badge variant="secondary">
                      {portal.daysRemaining} days remaining
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      {Math.abs(portal.daysRemaining)} days past end date
                    </Badge>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              <ul className="space-y-3">
                {milestones.map(
                  (m: {
                    id: string;
                    name: string;
                    status: string;
                    description?: string | null;
                    dueDate?: string | null;
                  }) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 text-sm border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "font-medium",
                            m.status === "DONE" && "line-through text-muted-foreground",
                          )}
                        >
                          {m.name}
                        </p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {m.description}
                          </p>
                        )}
                        {m.dueDate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Due {formatDate(m.dueDate)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          m.status === "DONE"
                            ? "success"
                            : m.status === "IN_PROGRESS"
                              ? "info"
                              : "secondary"
                        }
                        className="shrink-0"
                      >
                        {MILESTONE_LABEL[m.status] ?? m.status}
                      </Badge>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4" /> Client tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {tasks.map(
                  (t: {
                    id: string;
                    title: string;
                    description?: string | null;
                    status: string;
                    estimatedHours?: string | number | null;
                    milestone?: { name: string } | null;
                  }) => (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      {t.status === "DONE" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      ) : t.status === "IN_PROGRESS" ? (
                        <Loader2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium",
                            t.status === "DONE" && "line-through text-muted-foreground",
                          )}
                        >
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {t.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t.milestone?.name ? `${t.milestone.name} · ` : ""}
                          {t.estimatedHours != null
                            ? `${Number(t.estimatedHours)} hrs · `
                            : ""}
                          {TASK_LABEL[t.status] ?? t.status}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        {issues.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Work items</CardTitle>
              <CardDescription>
                {portal.issueCounts?.done ?? 0} done ·{" "}
                {portal.issueCounts?.inProgress ?? 0} in progress ·{" "}
                {portal.issueCounts?.todo ?? 0} to do
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {statusKeys.map((status) => {
                const items = boardByStatus[status] || [];
                if (!items.length) return null;
                return (
                  <div key={status}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {ISSUE_STATUS_LABEL[status] ?? status} ({items.length})
                    </p>
                    <ul className="space-y-2">
                      {items.map((issue) => (
                          <li
                            key={issue.id}
                            className="rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {issue.key}
                              </span>
                              {issue.type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {issue.type}
                                </Badge>
                              )}
                              {issue.priority && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {issue.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium mt-0.5">{issue.title}</p>
                            {issue.milestone?.name && (
                              <p className="text-xs text-muted-foreground">
                                {issue.milestone.name}
                              </p>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {documents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {documents.map(
                  (doc: {
                    id: string;
                    name: string;
                    originalName?: string;
                    storageUrl?: string | null;
                    size?: number;
                  }) => (
                    <li key={doc.id}>
                      <a
                        href={doc.storageUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <span className="font-medium truncate">
                          {doc.originalName || doc.name}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        {!tasks.length && !issues.length && !milestones.length && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Project content will appear here as the team adds milestones, tasks, and files.
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2 pb-6">
          Powered by TaskFlow by Vedha · Shared link (no account required)
        </p>
      </div>
    </div>
  );
}

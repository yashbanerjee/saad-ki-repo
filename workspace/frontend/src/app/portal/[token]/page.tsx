"use client";

import { useMemo } from "react";
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
  Kanban,
  Activity,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  KanbanBoard,
  defaultColumns,
  type KanbanColumn,
  type KanbanTask,
} from "@/components/features/KanbanBoard";
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

function mapPriority(p?: string): KanbanTask["priority"] {
  const v = (p || "MEDIUM").toUpperCase();
  if (v === "HIGH" || v === "CRITICAL" || v === "HIGHEST") return "high";
  if (v === "LOW" || v === "LOWEST") return "low";
  return "medium";
}

function formatBytes(size?: number) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => portalApi.get(token),
    retry: false,
  });

  const portal = data?.data?.data ?? data?.data ?? null;

  const boardColumns: KanbanColumn[] = useMemo(() => {
    if (!portal) return defaultColumns.filter((c) =>
      ["TODO", "IN_PROGRESS", "TESTING", "DONE"].includes(c.id),
    );

    const cols = portal.columns as
      | Array<{
          id: string;
          title: string;
          tasks?: Array<{
            id: string;
            key?: string;
            title: string;
            type?: string;
            priority?: string;
            status?: string;
            dueDate?: string | null;
          }>;
        }>
      | undefined;

    if (Array.isArray(cols) && cols.length > 0) {
      return cols.map((col) => ({
        id: col.id,
        title: col.title,
        tasks: (col.tasks ?? []).map((t) => ({
          id: t.id,
          key: t.key,
          title: t.title,
          type: t.type,
          status: t.status || col.id,
          priority: mapPriority(t.priority),
          dueDate: t.dueDate
            ? formatDate(t.dueDate)
            : undefined,
        })),
      }));
    }

    // Fallback: group portal.issues
    const issues = (portal.issues ?? []) as Array<{
      id: string;
      key?: string;
      title: string;
      type?: string;
      priority?: string;
      status?: string;
      dueDate?: string | null;
    }>;

    const mapStatus = (s?: string) => {
      if (!s) return "TODO";
      if (s === "IN_PROGRESS" || s === "BLOCKED") return "IN_PROGRESS";
      if (["TESTING", "QA_FAILED"].includes(s)) return "TESTING";
      if (s === "CODE_REVIEW") return "CODE_REVIEW";
      if (["READY_FOR_QA", "READY_FOR_RELEASE"].includes(s)) return "READY_FOR_QA";
      if (s === "DONE") return "DONE";
      return "TODO";
    };

    const base = defaultColumns.map((c) => ({ ...c, tasks: [] as KanbanTask[] }));
    for (const issue of issues) {
      const colId = mapStatus(issue.status);
      const col = base.find((c) => c.id === colId) || base[0];
      col.tasks.push({
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        status: issue.status,
        priority: mapPriority(issue.priority),
        dueDate: issue.dueDate ? formatDate(issue.dueDate) : undefined,
      });
    }
    return base;
  }, [portal]);

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
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
  const documents = portal.documents ?? [];
  const issueCounts = portal.issueCounts ?? {};
  const totalIssues = Number(issueCounts.total ?? 0);
  const doneIssues = Number(issueCounts.done ?? 0);
  const inProgressIssues = Number(issueCounts.inProgress ?? 0);
  const todoIssues = Number(issueCounts.todo ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary min-w-0">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">{portal.companyName || "TaskFlow by Vedha"}</span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Client project view · No login
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Project header — same role as logged-in project detail */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {portal.projectKey && (
                <Badge variant="outline" className="font-mono">
                  {portal.projectKey}
                </Badge>
              )}
              {portal.status && <Badge variant="success">{portal.status}</Badge>}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {portal.projectName}
            </h1>
            {portal.clientName && (
              <p className="text-muted-foreground text-sm mt-0.5">
                For {portal.clientName}
              </p>
            )}
            {portal.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap max-w-2xl mt-2">
                {portal.description}
              </p>
            )}
          </div>
        </div>

        {/* Overview stats — matches project overview cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="!shadow-sm border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display font-bold text-primary">{progress}%</p>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="!shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Current work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">To do</span>
                <span className="font-semibold tabular-nums">{todoIssues}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">In progress</span>
                <span className="font-semibold tabular-nums text-amber-700">
                  {inProgressIssues}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Done</span>
                <span className="font-semibold tabular-nums text-emerald-700">
                  {doneIssues}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground">Total items</span>
                <span className="font-semibold tabular-nums">{totalIssues}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="!shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Timeline
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
                <div className="pt-1">
                  {portal.daysRemaining >= 0 ? (
                    <Badge variant="secondary">
                      {portal.daysRemaining} days remaining
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      {Math.abs(portal.daysRemaining)} days past end
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="!shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display font-bold tabular-nums">
                {documents.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Files shared on this project
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Kanban board — same component as logged-in board */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Kanban className="h-5 w-5 text-primary" />
                Kanban board
              </h2>
              <p className="text-sm text-muted-foreground">
                Live work status · read-only view
              </p>
            </div>
          </div>
          <KanbanBoard
            initialColumns={boardColumns}
            canCreate={false}
            readOnly
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Documents with links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Document links
              </CardTitle>
              <CardDescription>
                Open or download project files
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No documents shared yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map(
                    (doc: {
                      id: string;
                      name: string;
                      originalName?: string;
                      storageUrl?: string | null;
                      size?: number;
                      mimeType?: string;
                    }) => {
                      const label = doc.originalName || doc.name;
                      const href = doc.storageUrl;
                      return (
                        <li key={doc.id}>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <Download className="h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{label}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {[doc.mimeType, formatBytes(doc.size)]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">{label}</span>
                              <span className="text-[11px] ml-auto">Unavailable</span>
                            </div>
                          )}
                        </li>
                      );
                    },
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" /> Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No milestones yet.
                </p>
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
                              m.status === "DONE" &&
                                "line-through text-muted-foreground",
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
        </div>

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
                            t.status === "DONE" &&
                              "line-through text-muted-foreground",
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

        <p className="text-center text-xs text-muted-foreground pt-2 pb-8">
          Powered by TaskFlow by Vedha · Shared link (no account required)
        </p>
      </div>
    </div>
  );
}

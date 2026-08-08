"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Plus,
  Link2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KanbanBoard,
  defaultColumns,
  type KanbanColumn,
  type KanbanTask,
} from "@/components/features/KanbanBoard";
import { portalApi } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const taskFileRef = useRef<HTMLInputElement>(null);

  const [taskOpen, setTaskOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    milestoneId: "",
  });
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    description: "",
    dueDate: "",
  });
  /** YYYY-MM or "all" */
  const [monthFilter, setMonthFilter] = useState<string>("all");
  /** all | client | admin | employee | other */
  const [creatorFilter, setCreatorFilter] = useState<string>("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => portalApi.get(token),
    retry: false,
  });

  const portal = data?.data?.data ?? data?.data ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["portal", token] });
  };

  const MAX_TASK_FILES = 10;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;

  const addTaskFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...taskFiles];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 15 MB`);
        continue;
      }
      if (next.length >= MAX_TASK_FILES) {
        toast.error(`Maximum ${MAX_TASK_FILES} files per task`);
        break;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    setTaskFiles(next);
    if (taskFileRef.current) taskFileRef.current.value = "";
  };

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await portalApi.createTask(token, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        status: taskForm.status,
        priority: taskForm.priority,
        milestoneId: taskForm.milestoneId || undefined,
      });
      const created = res?.data?.data ?? res?.data;
      const taskId = created?.id as string | undefined;
      let uploaded = 0;
      let failed = 0;
      if (taskId && taskFiles.length) {
        for (const file of taskFiles) {
          try {
            await portalApi.uploadTaskAttachment(token, taskId, file);
            uploaded += 1;
          } catch {
            failed += 1;
          }
        }
      }
      return { created, uploaded, failed };
    },
    onSuccess: ({ uploaded, failed }) => {
      invalidate();
      setTaskOpen(false);
      setTaskForm({
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        milestoneId: "",
      });
      setTaskFiles([]);
      if (uploaded && !failed) {
        toast.success(
          `Task created with ${uploaded} document${uploaded === 1 ? "" : "s"}`,
        );
      } else if (uploaded && failed) {
        toast.warning(
          `Task created. ${uploaded} file(s) uploaded, ${failed} failed`,
        );
      } else if (failed && !uploaded) {
        toast.warning("Task created, but document upload failed");
      } else {
        toast.success("Task created (tagged as Client)");
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not create task");
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: () =>
      portalApi.createMilestone(token, {
        name: milestoneForm.name.trim(),
        description: milestoneForm.description.trim() || undefined,
        dueDate: milestoneForm.dueDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setMilestoneOpen(false);
      setMilestoneForm({ name: "", description: "", dueDate: "" });
      toast.success("Milestone added");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not add milestone");
    },
  });

  const handlePortalDownload = async (doc: {
    id: string;
    name: string;
    originalName?: string;
    storageUrl?: string | null;
    mimeType?: string;
  }) => {
    const isLink = doc.mimeType === "text/uri-list";
    if (isLink && doc.storageUrl) {
      window.open(doc.storageUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (doc.storageUrl && !doc.storageUrl.startsWith("/")) {
      window.open(doc.storageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const res = await portalApi.downloadDocument(token, doc.id);
      const payload = res.data?.data ?? res.data;
      if (payload?.kind === "url" && payload.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (payload?.kind === "base64" && payload.content) {
        const binary = atob(payload.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: payload.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = payload.name || doc.originalName || doc.name;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      toast.error("Download not available");
    } catch {
      toast.error("Could not download document");
    }
  };

  type PortalTask = {
    id: string;
    key?: string;
    title: string;
    type?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    createdAt?: string | null;
    creatorKind?: string;
    creatorLabel?: string;
    reporter?: string;
  };

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    const now = new Date();
    // Last 12 months always available
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const cols = portal?.columns as Array<{ tasks?: PortalTask[] }> | undefined;
    if (Array.isArray(cols)) {
      for (const col of cols) {
        for (const t of col.tasks ?? []) {
          if (t.createdAt) {
            const d = new Date(t.createdAt);
            if (!Number.isNaN(d.getTime())) {
              keys.add(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
              );
            }
          }
        }
      }
    }
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [portal]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) return key;
    return new Date(y, m - 1, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  const taskMatchesFilters = (t: PortalTask) => {
    if (monthFilter !== "all") {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key !== monthFilter) return false;
    }
    if (creatorFilter !== "all") {
      const kind = (t.creatorKind || "other").toLowerCase();
      if (kind !== creatorFilter) return false;
    }
    return true;
  };

  const boardColumns: KanbanColumn[] = useMemo(() => {
    const empty = defaultColumns.map((c) => ({ ...c, tasks: [] as KanbanTask[] }));
    if (!portal) return empty;

    const cols = portal.columns as
      | Array<{
          id: string;
          title: string;
          tasks?: PortalTask[];
        }>
      | undefined;

    if (Array.isArray(cols) && cols.length > 0) {
      return cols.map((col) => ({
        id: col.id,
        title: col.title || col.id,
        tasks: (col.tasks ?? []).filter(taskMatchesFilters).map((t) => ({
          id: t.id,
          key: t.key,
          title: t.title,
          type: t.type,
          status: t.status || col.id,
          priority: mapPriority(t.priority),
          dueDate: t.dueDate ? formatDate(t.dueDate) : undefined,
          creatorKind: t.creatorKind,
          creatorLabel: t.creatorLabel,
          reporter: t.reporter,
        })),
      }));
    }

    return empty;
  }, [portal, monthFilter, creatorFilter]);

  const filteredTaskCount = useMemo(
    () => boardColumns.reduce((sum, col) => sum + col.tasks.length, 0),
    [boardColumns],
  );

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
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary min-w-0">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">{portal.companyName || "TaskFlow by Vedha"}</span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Collaborative project view · No login
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTaskOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create task
            </Button>
            <Button variant="outline" onClick={() => setMilestoneOpen(true)}>
              <Layers className="h-4 w-4 mr-1" /> Add milestone
            </Button>
          </div>
        </div>

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
                Files & shared links
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Kanban className="h-5 w-5 text-primary" />
                Kanban board
              </h2>
              <p className="text-sm text-muted-foreground">
                Filter by month and who created the task · {filteredTaskCount} shown
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {monthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Created by</Label>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Created by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => setTaskOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New task
              </Button>
            </div>
          </div>
          <KanbanBoard
            initialColumns={boardColumns}
            canCreate={false}
            readOnly
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Documents
                </CardTitle>
                <CardDescription>
                  Shared files from the project team (view only)
                </CardDescription>
              </div>
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
                      const isLink = doc.mimeType === "text/uri-list";
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => handlePortalDownload(doc)}
                            className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors text-left"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {isLink ? (
                                <Link2 className="h-4 w-4 shrink-0 text-primary" />
                              ) : (
                                <Download className="h-4 w-4 shrink-0 text-primary" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium truncate">{label}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {isLink
                                    ? "External link"
                                    : [doc.mimeType, formatBytes(doc.size)]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    },
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Milestones
                </CardTitle>
              </div>
              <Button size="sm" variant="outline" onClick={() => setMilestoneOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No milestones yet. Add one to track phase goals.
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
                <ListTodo className="h-4 w-4" /> Client task list
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
          Powered by TaskFlow by Vedha · Shared collaborative link (no account required)
        </p>
      </div>

      {/* Create task */}
      <Dialog
        open={taskOpen}
        onOpenChange={(open) => {
          setTaskOpen(open);
          if (!open) setTaskFiles([]);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What needs to be done?"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder="Details…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(v) =>
                    setTaskForm((f) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {boardColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) =>
                    setTaskForm((f) => ({ ...f, priority: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {milestones.length > 0 && (
              <div className="space-y-2">
                <Label>Milestone (optional)</Label>
                <Select
                  value={taskForm.milestoneId || "none"}
                  onValueChange={(v) =>
                    setTaskForm((f) => ({
                      ...f,
                      milestoneId: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {milestones.map((m: { id: string; name: string }) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Documents
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => taskFileRef.current?.click()}
                >
                  Add files
                </Button>
                <input
                  ref={taskFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addTaskFiles(e.target.files)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optional. Up to 10 files, 15 MB each. This task will be tagged as{" "}
                <span className="font-medium text-foreground">Client</span>.
              </p>
              {taskFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No files selected</p>
              ) : (
                <ul className="space-y-1.5">
                  {taskFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${file.size}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {file.name}
                        <span className="text-muted-foreground shrink-0">
                          {formatBytes(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted"
                        onClick={() =>
                          setTaskFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTaskOpen(false);
                setTaskFiles([]);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!taskForm.title.trim() || createTaskMutation.isPending}
              onClick={() => createTaskMutation.mutate()}
            >
              {createTaskMutation.isPending
                ? taskFiles.length
                  ? "Creating & uploading…"
                  : "Creating…"
                : taskFiles.length
                  ? `Create with ${taskFiles.length} file${taskFiles.length === 1 ? "" : "s"}`
                  : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add milestone */}
      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={milestoneForm.name}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Design approval"
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={milestoneForm.dueDate}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={milestoneForm.description}
                onChange={(e) =>
                  setMilestoneForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !milestoneForm.name.trim() || createMilestoneMutation.isPending
              }
              onClick={() => createMilestoneMutation.mutate()}
            >
              {createMilestoneMutation.isPending ? "Adding…" : "Add milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

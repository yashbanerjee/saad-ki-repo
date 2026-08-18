"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bug,
  Clock,
  MessageSquare,
  Send,
  Paperclip,
  Upload,
  FileText,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { issuesApi, projectsApi } from "@/lib/api";
import { cn, formatDate, formatRelativeTime, getInitials } from "@/lib/utils";
import { hasRole, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

const FALLBACK_STATUSES = [
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "TESTING", label: "Testing" },
  { value: "DONE", label: "Done" },
] as const;

const creatorStyles: Record<string, string> = {
  client: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
  admin: "bg-vedha-teal/15 text-vedha-teal border-vedha-teal/30 dark:text-vedha-cyan",
  employee: "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-200",
  other: "bg-muted text-muted-foreground border-border",
};

function personName(p?: { firstName?: string; lastName?: string; name?: string } | string | null) {
  if (!p) return "—";
  if (typeof p === "string") return p;
  if (p.name) return p.name;
  return `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—";
}

function formatBytes(size?: number) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IssueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [hours, setHours] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isPrivileged = hasRole(user, ["admin", "manager"]);

  const { data, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.get(id),
    retry: false,
  });

  const issue = data?.data?.data ?? data?.data ?? null;
  const projectId = issue?.project?.id as string | undefined;
  const canEditStatus = issue?.canEditStatus !== false;
  const canFullyEdit = issue?.canFullyEdit === true || isPrivileged;
  const canDelete = issue?.canDelete === true || isPrivileged;

  const { data: projectDetail } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: Boolean(projectId && canFullyEdit),
  });
  const projectMembers = Array.isArray(
    (projectDetail?.data?.data ?? projectDetail?.data)?.members,
  )
    ? (projectDetail?.data?.data ?? projectDetail?.data).members
    : [];

  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ["time-entries", id],
    queryFn: () => issuesApi.listTimeEntries(id),
    enabled: Boolean(id),
  });

  const boardColumns: { id: string; title: string }[] = Array.isArray(issue?.boardColumns)
    ? issue.boardColumns
    : FALLBACK_STATUSES.map((s) => ({ id: s.value, title: s.label }));

  const comments = Array.isArray(issue?.comments) ? issue.comments : [];
  const attachments = Array.isArray(issue?.attachments) ? issue.attachments : [];
  const timeEntriesFromIssue = Array.isArray(issue?.timeEntries) ? issue.timeEntries : [];
  const timeEntriesRaw = timeData?.data?.data ?? timeData?.data;
  const timeEntries = Array.isArray(timeEntriesRaw) ? timeEntriesRaw : timeEntriesFromIssue;

  const currentColumn =
    String(issue?.boardColumnId || issue?.status || "TODO");
  const creatorKind = String(issue?.creatorKind || "other").toLowerCase();
  const creatorLabel = issue?.creatorLabel || creatorKind;

  const deleteIssueMutation = useMutation({
    mutationFn: () => issuesApi.delete(id),
    onSuccess: () => {
      toast.success("Task deleted");
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
        router.push(`/projects/${projectId}/board`);
      } else {
        router.push("/issues");
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not delete task");
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => issuesApi.addComment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      setComment("");
      toast.success("Comment added");
    },
    onError: () => toast.error("Failed to add comment"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let uploaded = 0;
      let failed = 0;
      for (const file of files) {
        try {
          await issuesApi.uploadAttachment(id, file);
          uploaded += 1;
        } catch {
          failed += 1;
        }
      }
      return { uploaded, failed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      if (result.failed && !result.uploaded) {
        toast.error("Upload failed");
      } else if (result.failed) {
        toast.warning(`${result.uploaded} uploaded, ${result.failed} failed`);
      } else {
        toast.success(
          result.uploaded === 1
            ? "File uploaded"
            : `${result.uploaded} files uploaded`,
        );
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => issuesApi.deleteAttachment(id, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      toast.success("Attachment removed");
    },
    onError: () => toast.error("Failed to delete attachment"),
  });

  const statusMutation = useMutation({
    mutationFn: async (columnId: string) => {
      if (projectId) {
        return projectsApi.updateTaskStatus(projectId, id, columnId);
      }
      return issuesApi.transition(id, columnId);
    },
    onSuccess: (_res, columnId) => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      const title =
        boardColumns.find((c) => c.id === columnId)?.title || columnId.replace(/_/g, " ");
      toast.success(`Moved to ${title}`);
    },
    onError: (err: { response?: { data?: { message?: string }; status?: number } }) => {
      toast.error(
        err?.response?.status === 401
          ? "Session expired — please sign in again"
          : err?.response?.data?.message || "Failed to update status",
      );
    },
  });

  const assigneeMutation = useMutation({
    mutationFn: (nextAssigneeId: string | null) =>
      issuesApi.update(id, { assigneeId: nextAssigneeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      toast.success("Assignee updated");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update assignee");
    },
  });

  const logTime = useMutation({
    mutationFn: () =>
      issuesApi.addTimeEntry(id, {
        hours: Number(hours),
        description: timeNote.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      queryClient.invalidateQueries({ queryKey: ["time-entries", id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      setHours("");
      setTimeNote("");
      toast.success("Time logged");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not log time");
    },
  });

  const deleteTime = useMutation({
    mutationFn: (entryId: string) => issuesApi.removeTimeEntry(id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      queryClient.invalidateQueries({ queryKey: ["time-entries", id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      toast.success("Time entry removed");
    },
    onError: () => toast.error("Could not remove entry"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!issue) {
    return (
      <EmptyState
        icon={Bug}
        title="Issue not found"
        description="This issue doesn't exist or you don't have access to it."
        actionLabel="Back to projects"
        actionHref="/projects"
      />
    );
  }

  const backHref = projectId ? `/projects/${projectId}/board` : "/issues";
  const boardColumnSelectValue = boardColumns.some((c) => c.id === currentColumn)
    ? currentColumn
    : boardColumns[0]?.id || "TODO";

  return (
    <div className="space-y-6">
      {/* Jira-style header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-0.5">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {issue.key || `#${issue.id}`}
            </span>
            {issue.type && <Badge variant="outline">{issue.type}</Badge>}
            {issue.priority && (
              <Badge variant="destructive" className="capitalize">
                {String(issue.priority).toLowerCase()}
              </Badge>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                creatorStyles[creatorKind] || creatorStyles.other,
              )}
            >
              <UserRound className="mr-1 h-3 w-3" />
              Created by {creatorLabel}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight">{issue.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {issue.project?.client?.name && (
              <>
                Client:{" "}
                <span className="font-medium text-foreground">
                  {issue.project.client.name}
                </span>
                {issue.project?.name ? " · " : ""}
              </>
            )}
            {issue.project?.name && (
              <>
                <Link
                  href={`/projects/${projectId}/board`}
                  className="text-primary hover:underline"
                >
                  {issue.project.name}
                </Link>
                {issue.milestone?.name ? ` · ${issue.milestone.name}` : ""}
              </>
            )}
          </p>
        </div>
        {canDelete && (
          <Button
            variant="outline"
            className="shrink-0 text-destructive hover:text-destructive"
            disabled={deleteIssueMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete ${issue.key || issue.title}? This cannot be undone.`,
                )
              ) {
                deleteIssueMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleteIssueMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {issue.description || "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Documents ({attachments.length})
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Attach files related to this task
                </CardDescription>
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    if (files.length) uploadMutation.mutate(files);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploadMutation.isPending ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                attachments.map(
                  (a: {
                    id: string;
                    name: string;
                    storageUrl?: string | null;
                    size?: number;
                    uploadedBy?: { firstName?: string; lastName?: string };
                  }) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          {a.storageUrl ? (
                            <a
                              href={a.storageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-medium hover:underline"
                            >
                              {a.name}
                            </a>
                          ) : (
                            <p className="truncate text-sm font-medium">{a.name}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {personName(a.uploadedBy)}
                            {a.size ? ` · ${formatBytes(a.size)}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => deleteMutation.mutate(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Time tracking
              </CardTitle>
              <CardDescription className="text-xs">
                Logged {issue.loggedHours ?? 0}h
                {issue.estimatedHours != null ? ` · Est. ${issue.estimatedHours}h` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  placeholder="Hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-28"
                />
                <Input
                  placeholder="Note (optional)"
                  value={timeNote}
                  onChange={(e) => setTimeNote(e.target.value)}
                  className="min-w-[12rem] flex-1"
                />
                <Button
                  size="sm"
                  disabled={!hours || Number(hours) <= 0 || logTime.isPending}
                  onClick={() => logTime.mutate()}
                >
                  {logTime.isPending ? "Saving…" : "Log time"}
                </Button>
              </div>

              {timeLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time logged yet.</p>
              ) : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                  {timeEntries.map(
                    (e: {
                      id: string;
                      hours: number;
                      description?: string;
                      date?: string;
                      user?: { firstName?: string; lastName?: string };
                    }) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{e.hours}h</span>
                          {e.description ? ` — ${e.description}` : ""}
                          <p className="text-xs text-muted-foreground">
                            {[
                              e.user
                                ? `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim()
                                : null,
                              e.date ? formatDate(e.date) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => deleteTime.mutate(e.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Activity ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length > 0 ? (
                comments.map(
                  (c: {
                    id: string;
                    body?: string;
                    content?: string;
                    createdAt: string;
                    author?: { firstName?: string; lastName?: string } | string;
                  }) => {
                    const author = personName(c.author);
                    return (
                      <div key={c.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(author)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{author}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap">
                            {c.body || c.content}
                          </p>
                        </div>
                      </div>
                    );
                  },
                )
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              <Separator />
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate(comment)}
              >
                <Send className="h-4 w-4 mr-1" /> Comment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Jira-style details sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <span className="text-muted-foreground">Status</span>
                <Select
                  value={boardColumnSelectValue}
                  disabled={statusMutation.isPending || !canEditStatus}
                  onValueChange={(value) => {
                    if (value !== currentColumn) statusMutation.mutate(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {boardColumns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusMutation.isPending && (
                  <p className="text-[11px] text-muted-foreground">Updating status…</p>
                )}
                {!canEditStatus && (
                  <p className="text-[11px] text-muted-foreground">
                    You can only change status on tasks assigned to you.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-muted-foreground">Assignee</span>
                {canFullyEdit ? (
                  <Select
                    value={issue.assigneeId || issue.assignee?.id || "unassigned"}
                    disabled={assigneeMutation.isPending}
                    onValueChange={(value) => {
                      assigneeMutation.mutate(value === "unassigned" ? null : value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {projectMembers.map(
                        (m: {
                          user?: {
                            id: string;
                            firstName?: string;
                            lastName?: string;
                            email?: string;
                          };
                          userId?: string;
                        }) => {
                          const uid = m.user?.id || m.userId;
                          if (!uid) return null;
                          const name =
                            `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                            m.user?.email ||
                            uid;
                          return (
                            <SelectItem key={uid} value={uid}>
                              {name}
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex justify-end">
                    <span className="text-right">{personName(issue.assignee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Reporter</span>
                <span className="text-right">{personName(issue.reporter)}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-muted-foreground">Created by</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
                    creatorStyles[creatorKind] || creatorStyles.other,
                  )}
                >
                  {creatorLabel}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Client</span>
                <span className="text-right font-medium">
                  {issue.project?.client?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right">
                  {issue.project?.name || issue.project || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Milestone</span>
                <span className="text-right">{issue.milestone?.name || "—"}</span>
              </div>
              {issue.type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline">{issue.type}</Badge>
                </div>
              )}
              {issue.priority && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge variant="destructive">{issue.priority}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time logged</span>
                <span>
                  {issue.loggedHours ?? 0}h
                  {issue.estimatedHours != null ? ` / ${issue.estimatedHours}h` : ""}
                </span>
              </div>
              {issue.createdAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatRelativeTime(issue.createdAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {projectId && (
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/projects/${projectId}/board`}>Back to board</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

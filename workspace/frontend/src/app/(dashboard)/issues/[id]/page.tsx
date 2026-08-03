"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bug,
  MessageSquare,
  Send,
  Paperclip,
  Upload,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { issuesApi } from "@/lib/api";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";

const CLIENT_STATUSES = [
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "TESTING", label: "Testing" },
  { value: "DONE", label: "Done" },
] as const;

const STAFF_STATUSES = [
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "TESTING", label: "Testing" },
  { value: "CODE_REVIEW", label: "Code Review" },
  { value: "READY_FOR_QA", label: "Ready for QA" },
  { value: "QA_FAILED", label: "QA Failed" },
  { value: "READY_FOR_RELEASE", label: "Ready for Release" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function personName(p?: { firstName?: string; lastName?: string; name?: string } | string | null) {
  if (!p) return "—";
  if (typeof p === "string") return p;
  if (p.name) return p.name;
  return `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—";
}

function statusLabel(value: string, options: readonly { value: string; label: string }[]) {
  return options.find((o) => o.value === value)?.label || value.replace(/_/g, " ");
}

export default function IssueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [comment, setComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const statusOptions = isClient ? CLIENT_STATUSES : STAFF_STATUSES;

  const { data, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.get(id),
    retry: false,
  });

  const issue = data?.data?.data ?? data?.data ?? null;

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
    mutationFn: (file: File) => issuesApi.uploadAttachment(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      toast.success("File uploaded");
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
    mutationFn: (status: string) => issuesApi.transition(id, status),
    onSuccess: (_res, status) => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      const projectId = issue?.project?.id;
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      }
      toast.success(`Status updated to ${statusLabel(status, statusOptions)}`);
    },
    onError: (err: { response?: { data?: { message?: string }; status?: number } }) => {
      toast.error(
        err?.response?.status === 401
          ? "Session expired — please sign in again"
          : err?.response?.data?.message || "Failed to update status",
      );
    },
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

  const backHref = issue.project?.id
    ? `/projects/${issue.project.id}/board`
    : "/issues";

  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const attachments = Array.isArray(issue.attachments) ? issue.attachments : [];
  const currentStatus = String(issue.status || "TODO");

  const selectOptions =
    statusOptions.some((o) => o.value === currentStatus)
      ? statusOptions
      : [
          { value: currentStatus, label: statusLabel(currentStatus, STAFF_STATUSES) },
          ...statusOptions,
        ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{issue.key || `#${issue.id}`}</span>
            {issue.priority && <Badge variant="destructive">{issue.priority}</Badge>}
            <Badge variant="info">{statusLabel(currentStatus, STAFF_STATUSES)}</Badge>
            {issue.type && <Badge variant="outline">{issue.type}</Badge>}
          </div>
          <h1 className="font-display text-2xl font-bold">{issue.title}</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
              </CardTitle>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
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
                <p className="text-sm text-muted-foreground">No files attached yet.</p>
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
                            {a.size ? ` · ${(a.size / 1024).toFixed(1)} KB` : ""}
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
                <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
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
              <div className="flex gap-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </div>
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <span className="text-muted-foreground">Status</span>
                <Select
                  value={currentStatus}
                  disabled={statusMutation.isPending}
                  onValueChange={(value) => {
                    if (value !== currentStatus) statusMutation.mutate(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusMutation.isPending && (
                  <p className="text-[11px] text-muted-foreground">Updating status…</p>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Assignee</span>
                <span className="text-right">{personName(issue.assignee)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Reporter</span>
                <span className="text-right">{personName(issue.reporter)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right">
                  {issue.project?.name || issue.project || "—"}
                </span>
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
              {issue.createdAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatRelativeTime(issue.createdAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

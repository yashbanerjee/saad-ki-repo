"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Plus, Filter, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientsApi, issuesApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

const typeIcons = { BUG: Bug, TASK: Filter, STORY: Plus, FEATURE_REQUEST: Plus };
const priorityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGHEST: "destructive",
  HIGH: "destructive",
  CRITICAL: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
  LOWEST: "secondary",
};

function personName(p?: { firstName?: string; lastName?: string } | string | null) {
  if (!p) return "";
  if (typeof p === "string") return p;
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export default function IssuesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients", "issues-filter"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["issues", statusFilter, typeFilter, clientFilter],
    queryFn: () =>
      issuesApi.list({
        limit: 100,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        clientId: clientFilter !== "all" ? clientFilter : undefined,
      }),
    retry: false,
  });

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  const issues = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const deleteIssue = useMutation({
    mutationFn: (issueId: string) => issuesApi.delete(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Task deleted");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not delete task");
    },
  });

  const filtered = issues.filter((issue: { title?: string; key?: string }) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(issue.title || "")
        .toLowerCase()
        .includes(q) ||
      String(issue.key || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Issues</h1>
          <p className="text-muted-foreground">Track bugs, features, and tasks</p>
        </div>
        <Button asChild>
          <Link href="/projects">
            <Plus className="h-4 w-4 mr-1" /> New Issue
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clientsLoading ? (
              <SelectItem value="__loading" disabled>
                Loading Clients...
              </SelectItem>
            ) : clients.length === 0 ? (
              <SelectItem value="__empty" disabled>
                No Clients Found
              </SelectItem>
            ) : (
              clients.map((c: { id: string; name: string }) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="TESTING">Testing</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="TASK">Task</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="STORY">Story</SelectItem>
            <SelectItem value="EPIC">Epic</SelectItem>
          </SelectContent>
        </Select>
        {clientFilter !== "all" && (
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() => setClientFilter("all")}
          >
            Clear client
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="No issues found"
          description={
            issues.length === 0
              ? "Create an issue to start tracking bugs, features, and tasks."
              : "No issues match your current filters."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(
                  (issue: {
                    id: string;
                    key?: string;
                    title: string;
                    type?: string;
                    priority?: string;
                    status?: string;
                    canDelete?: boolean;
                    assignee?: { firstName?: string; lastName?: string } | string;
                    project?: {
                      name?: string;
                      client?: { name?: string } | null;
                    };
                    updatedAt: string;
                  }) => {
                    const Icon =
                      typeIcons[issue.type as keyof typeof typeIcons] || Bug;
                    const clientName = issue.project?.client?.name;
                    return (
                      <TableRow key={issue.id}>
                        <TableCell>
                          <Link
                            href={`/issues/${issue.id}`}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {issue.key ? `${issue.key} · ` : ""}
                                {issue.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {[issue.project?.name, personName(issue.assignee)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {clientName ? (
                            <Badge variant="outline">{clientName}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {issue.priority ? (
                            <Badge
                              variant={
                                priorityVariant[issue.priority] || "secondary"
                              }
                            >
                              {issue.priority}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.status && (
                            <Badge variant="secondary">
                              {String(issue.status).replace(/_/g, " ")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {formatRelativeTime(issue.updatedAt)}
                        </TableCell>
                        <TableCell>
                          {issue.canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deleteIssue.isPending}
                              aria-label={`Delete ${issue.key || issue.title}`}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${issue.key || issue.title}? This cannot be undone.`,
                                  )
                                ) {
                                  deleteIssue.mutate(issue.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { issuesApi } from "@/lib/api";
import { spaceHref } from "@/lib/space-paths";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

const priorityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGHEST: "destructive",
  HIGH: "destructive",
  CRITICAL: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
  LOWEST: "secondary",
};

export default function SpaceListPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["issues", "space", id, statusFilter],
    queryFn: () =>
      issuesApi.list({
        projectId: id,
        limit: 100,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    retry: false,
  });

  const issues = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (i: { title?: string; key?: string }) =>
        i.title?.toLowerCase().includes(q) || i.key?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const deleteIssue = useMutation({
    mutationFn: (issueId: string) => issuesApi.delete(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      toast.success("Moved to trash");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search work items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="TODO">To do</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="IN_REVIEW">In review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="bg-[#0C66E4] hover:bg-[#0055CC]"
          onClick={() => router.push(`${spaceHref(id, "board")}?create=1`)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Create
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="No work items"
          description="Create a work item from the board or Create menu."
          actionLabel="Open board"
          actionHref={spaceHref(id, "board")}
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(
                (issue: {
                  id: string;
                  key?: string;
                  title: string;
                  status?: string;
                  priority?: string;
                  updatedAt?: string;
                }) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {issue.key || "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/issues/${issue.id}`}
                        className="font-medium hover:underline"
                      >
                        {issue.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{issue.status || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          priorityVariant[issue.priority || ""] || "secondary"
                        }
                      >
                        {issue.priority || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.updatedAt
                        ? formatRelativeTime(issue.updatedAt)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const ok = await confirm(
                            trashConfirm("work item", issue.title),
                          );
                          if (ok) deleteIssue.mutate(issue.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

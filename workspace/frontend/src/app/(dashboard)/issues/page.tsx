"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bug, Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { issuesApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const mockIssues = [
  { id: "1", title: "Login redirect loop on Safari", type: "bug", priority: "high", status: "open", assignee: "James L.", project: "Website Redesign", updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "2", title: "Add export to CSV functionality", type: "feature", priority: "medium", status: "in_progress", assignee: "Sarah K.", project: "CRM Integration", updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "3", title: "Mobile nav menu overlap", type: "bug", priority: "medium", status: "open", assignee: "Alex M.", project: "Mobile App v2", updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "4", title: "Update privacy policy page", type: "task", priority: "low", status: "review", assignee: "Sarah K.", project: "Website Redesign", updatedAt: new Date(Date.now() - 172800000).toISOString() },
];

const typeIcons = { bug: Bug, feature: Plus, task: Filter };
const priorityVariant = { high: "destructive" as const, medium: "warning" as const, low: "secondary" as const };
const statusVariant = { open: "info" as const, in_progress: "warning" as const, review: "secondary" as const, closed: "success" as const };

export default function IssuesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["issues", statusFilter, typeFilter],
    queryFn: () => issuesApi.list({ status: statusFilter !== "all" ? statusFilter : undefined, type: typeFilter !== "all" ? typeFilter : undefined }),
    retry: false,
  });

  const issues = data?.data?.data ?? data?.data ?? mockIssues;
  const filtered = (Array.isArray(issues) ? issues : mockIssues).filter(
    (issue: typeof mockIssues[0]) =>
      issue.title.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "all" || issue.status === statusFilter) &&
      (typeFilter === "all" || issue.type === typeFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Issues</h1>
          <p className="text-muted-foreground">Track bugs, features, and tasks</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" /> New Issue</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search issues..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="task">Task</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((issue: typeof mockIssues[0]) => {
                const Icon = typeIcons[issue.type as keyof typeof typeIcons] || Bug;
                return (
                  <Link key={issue.id} href={`/issues/${issue.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{issue.title}</p>
                      <p className="text-xs text-muted-foreground">{issue.project} · {issue.assignee}</p>
                    </div>
                    <Badge variant={priorityVariant[issue.priority as keyof typeof priorityVariant]}>{issue.priority}</Badge>
                    <Badge variant={statusVariant[issue.status as keyof typeof statusVariant]}>{issue.status.replace("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">{formatRelativeTime(issue.updatedAt)}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    );
  }

  if (isError || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <EmptyState
          title="Link not found"
          description="This client dashboard link is invalid or has been turned off."
        />
      </div>
    );
  }

  const progress = portal.progressPercent ?? 0;
  const milestones = portal.milestones ?? [];
  const tasks = portal.tasks ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            {portal.companyName || "TaskFlow by Vedha"}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {portal.projectName}
          </h1>
          {portal.clientName && (
            <p className="text-muted-foreground">For {portal.clientName}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button size="sm" asChild>
              <Link href={`/client-signup?portal=${token}`}>Create account</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/login?redirect=/client-portal`}>Sign in</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Create an account with email or mobile to save your login
          </p>
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project progress</CardTitle>
            <CardDescription>
              {portal.taskCounts?.done ?? 0} of {portal.taskCounts?.total ?? 0} tasks done
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-display font-bold text-primary mb-3">{progress}%</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
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
                  <Badge variant="secondary">{portal.daysRemaining} days remaining</Badge>
                ) : (
                  <Badge variant="warning">
                    {Math.abs(portal.daysRemaining)} days past end date
                  </Badge>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Milestones</CardTitle>
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
                    dueDate?: string | null;
                  }) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 text-sm"
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
                        {m.dueDate && (
                          <p className="text-xs text-muted-foreground">
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="space-y-3">
                {tasks.map(
                  (t: {
                    id: string;
                    title: string;
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
                        <p className="text-xs text-muted-foreground">
                          {t.milestone?.name ? `${t.milestone.name} · ` : ""}
                          {t.estimatedHours != null
                            ? `${Number(t.estimatedHours)} hrs`
                            : "—"}
                          {" · "}
                          {TASK_LABEL[t.status] ?? t.status}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-2">
          Powered by TaskFlow by Vedha
        </p>
      </div>
    </div>
  );
}

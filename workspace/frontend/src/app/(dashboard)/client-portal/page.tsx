"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  CheckCircle2,
  Calendar,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { projectsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";

export default function ClientPortalPage() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", "my-client"],
    queryFn: () => projectsApi.myClientProjects(),
    retry: false,
  });

  const projects = (() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  })();

  const totalTasks = projects.reduce(
    (sum: number, p: { taskCounts?: { total?: number } }) =>
      sum + (p.taskCounts?.total ?? 0),
    0,
  );
  const doneTasks = projects.reduce(
    (sum: number, p: { taskCounts?: { done?: number } }) =>
      sum + (p.taskCounts?.done ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Your projects and progress — signed in with{" "}
          {user?.email?.includes("@client.taskflow.local")
            ? "your mobile number"
            : user?.email || "your account"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{projects.length}</p>
              <p className="text-xs text-muted-foreground">Active projects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">
                {doneTasks}/{totalTasks}
              </p>
              <p className="text-xs text-muted-foreground">Tasks done</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">
                {projects.filter((p: { endDate?: string }) => p.endDate).length}
              </p>
              <p className="text-xs text-muted-foreground">With end dates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your projects</CardTitle>
          <CardDescription>Open a project to see timeline, milestones, and tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="When your agency links a project to you, it will show here. You can also open a shared project link."
              className="py-10"
            />
          ) : (
            <div className="space-y-4">
              {projects.map(
                (project: {
                  id: string;
                  name: string;
                  status: string;
                  progressPercent?: number;
                  startDate?: string | null;
                  endDate?: string | null;
                  portalUrl?: string | null;
                  portalToken?: string | null;
                  portalEnabled?: boolean;
                }) => {
                  const progress = project.progressPercent ?? 0;
                  const publicHref =
                    project.portalUrl ||
                    (project.portalEnabled && project.portalToken
                      ? `/portal/${project.portalToken}`
                      : null);
                  return (
                    <div
                      key={project.id}
                      className="rounded-xl border p-4 space-y-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {project.startDate || project.endDate
                              ? `${project.startDate ? formatDate(project.startDate) : "—"} → ${
                                  project.endDate ? formatDate(project.endDate) : "—"
                                }`
                              : "Timeline not set"}
                          </p>
                        </div>
                        <Badge variant="secondary">{project.status}</Badge>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {publicHref && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={publicHref}>
                            View dashboard <ExternalLink className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Need help? Contact your project manager at Vedha.
        <ArrowRight className="inline h-3.5 w-3.5 ml-1" />
      </p>
    </div>
  );
}

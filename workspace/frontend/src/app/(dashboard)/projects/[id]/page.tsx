"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Kanban,
  List,
  Zap,
  Users,
  Calendar,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { projectsApi } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const project = data?.data?.data ?? data?.data ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project doesn't exist or you don't have access to it."
        actionLabel="Back to projects"
        actionHref="/projects"
      />
    );
  }

  const clientName =
    typeof project.client === "string"
      ? project.client
      : project.client?.name ?? null;

  const team =
    project.team ??
    (project.members ?? []).map(
      (m: { user?: { firstName?: string; lastName?: string; email?: string } }) => ({
        name:
          [m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ") ||
          m.user?.email ||
          "Member",
      }),
    );

  const progress = project.progressPercent ?? project.progress ?? 0;

  const navItems = [
    {
      href: `/projects/${id}/client-progress`,
      label: "Client Progress",
      icon: LayoutDashboard,
      desc: "Timeline, milestones, client tasks & share link",
      primary: true,
    },
    { href: `/projects/${id}/board`, label: "Board", icon: Kanban, desc: "Kanban board — create tasks, Testing & more" },
    { href: `/projects/${id}/backlog`, label: "Backlog", icon: List, desc: "Internal task list" },
    { href: `/projects/${id}/sprints`, label: "Sprints", icon: Zap, desc: "Sprint planning" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold">{project.name}</h1>
            {project.status && <Badge variant="success">{project.status}</Badge>}
          </div>
          {clientName && <p className="text-muted-foreground">{clientName}</p>}
        </div>
        <div className="flex items-center gap-3">
          {team.length > 0 && (
            <div className="flex -space-x-2">
              {team.map((member: { name: string }) => (
                <Avatar key={member.name} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
          <Button asChild>
            <Link href={`/projects/${id}/client-progress`}>Client Progress</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          {project.description && <CardDescription>{project.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Client progress</p>
              <p className="text-2xl font-bold font-display text-primary">{progress}%</p>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Timeline
              </p>
              <p className="text-sm mt-1">
                {project.startDate ? formatDate(project.startDate) : "—"} —{" "}
                {project.endDate ? formatDate(project.endDate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Team
              </p>
              <p className="text-sm mt-1">{team.length || 0} members</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card
              className={`hover:shadow-md transition-all hover:border-primary/50 cursor-pointer h-full ${
                item.primary ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

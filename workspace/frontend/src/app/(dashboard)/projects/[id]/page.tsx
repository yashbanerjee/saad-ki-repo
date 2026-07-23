"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Kanban, List, Zap, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { projectsApi } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";

const mockProject = {
  id: "1",
  name: "Website Redesign",
  description: "Complete redesign of the corporate website with modern UI/UX, responsive design, and CMS integration.",
  status: "active",
  client: "Acme Corp",
  progress: 68,
  startDate: "2026-01-15",
  dueDate: "2026-03-15",
  team: [{ name: "Alex M." }, { name: "Sarah K." }, { name: "James L." }],
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const project = data?.data?.data ?? data?.data ?? { ...mockProject, id };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const navItems = [
    { href: `/projects/${id}/board`, label: "Board", icon: Kanban, desc: "Kanban task board" },
    { href: `/projects/${id}/backlog`, label: "Backlog", icon: List, desc: "Prioritized task list" },
    { href: `/projects/${id}/sprints`, label: "Sprints", icon: Zap, desc: "Sprint planning" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold">{project.name}</h1>
            <Badge variant="success">{project.status}</Badge>
          </div>
          <p className="text-muted-foreground">{project.client}</p>
        </div>
        <div className="flex -space-x-2">
          {project.team?.map((member: { name: string }) => (
            <Avatar key={member.name} className="h-8 w-8 border-2 border-background">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{project.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-2xl font-bold font-display text-primary">{project.progress}%</p>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Timeline</p>
              <p className="text-sm mt-1">{formatDate(project.startDate)} — {formatDate(project.dueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Team</p>
              <p className="text-sm mt-1">{project.team?.length || 0} members</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer h-full">
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

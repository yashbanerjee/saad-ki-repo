"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban, MoreHorizontal, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const statusVariant = { active: "success" as const, planning: "info" as const, completed: "secondary" as const, on_hold: "warning" as const };

interface Project {
  id: string;
  name: string;
  status: string;
  client?: string;
  tasks?: number;
  progress?: number;
  dueDate?: string;
}

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) => projectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: () => toast.error("Failed to create project"),
  });

  const projects: Project[] = data?.data?.data ?? data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage and track all your projects</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Add a new project to your workspace</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website Redesign" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Project description..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate({ name, description })} disabled={!name}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking work."
          actionLabel="New Project"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group hover:shadow-md transition-shadow glass-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors">
                          {project.name}
                        </Link>
                      </CardTitle>
                      {project.client && <CardDescription className="text-xs">{project.client}</CardDescription>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link href={`/projects/${project.id}`}>View</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/projects/${project.id}/board`}>Board</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/projects/${project.id}/backlog`}>Backlog</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={statusVariant[project.status as keyof typeof statusVariant] || "secondary"}>
                    {project.status}
                  </Badge>
                  {project.dueDate && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(project.dueDate)}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{project.tasks ?? 0} tasks</span>
                    <span className="font-medium">{project.progress ?? 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${project.progress ?? 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

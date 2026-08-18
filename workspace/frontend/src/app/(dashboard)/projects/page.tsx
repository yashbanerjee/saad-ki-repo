"use client";

import { useMemo, useState, KeyboardEvent, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  FolderKanban,
  MoreHorizontal,
  Calendar,
  X,
  Tag,
  ImagePlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientsApi, projectsApi } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { hasRole, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

const statusVariant = {
  ACTIVE: "success" as const,
  PLANNING: "info" as const,
  COMPLETED: "secondary" as const,
  ON_HOLD: "warning" as const,
  ARCHIVED: "secondary" as const,
  CANCELLED: "secondary" as const,
};

/** Suggested tags for client brands / project types */
const TAG_SUGGESTIONS = [
  "Vedha",
  "F&S",
  "Web",
  "App Dev",
  "ERP",
  "Mobile",
  "UI/UX",
  "Maintenance",
];

interface Project {
  id: string;
  name: string;
  status: string;
  avatar?: string | null;
  tags?: string[];
  client?: { id: string; name: string } | string | null;
  progressPercent?: number;
  progress?: number;
  endDate?: string;
  startDate?: string;
  _count?: { clientTasks?: number; issues?: number };
}

function TagChips({
  tags,
  onRemove,
  className,
}: {
  tags: string[];
  onRemove?: (tag: string) => void;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-[11px] font-normal gap-1 pr-1">
          {tag}
          {onRemove && (
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(tag);
              }}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = hasRole(user, ["admin", "manager"]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["projects", tagFilter],
    queryFn: () =>
      projectsApi.list(
        tagFilter !== "all" ? { tag: tagFilter, limit: 100 } : { limit: 100 },
      ),
    retry: false,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["project-tags"],
    queryFn: () => projectsApi.listTags(),
    retry: false,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "for-project"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    retry: false,
    enabled: open,
  });

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  const knownTags = useMemo(() => {
    const raw = tagsData?.data?.data ?? tagsData?.data ?? [];
    const fromApi = Array.isArray(raw) ? (raw as string[]) : [];
    const set = new Set([...TAG_SUGGESTIONS, ...fromApi, ...tags]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tagsData, tags]);

  const addTag = (raw: string) => {
    const t = raw.trim().slice(0, 40);
    if (!t) return;
    setTags((prev) => {
      if (prev.some((p) => p.toLowerCase() === t.toLowerCase())) return prev;
      return [...prev, t].slice(0, 20);
    });
    setTagInput("");
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await projectsApi.create({
        name,
        description: description || undefined,
        clientId: clientId !== "none" ? clientId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        tags: tags.length ? tags : undefined,
      });
      const created = res?.data?.data ?? res?.data;
      const projectId = created?.id as string | undefined;
      if (projectId && logoFile) {
        try {
          await projectsApi.uploadLogo(projectId, logoFile);
        } catch {
          toast.warning("Project created, but logo upload failed");
        }
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-tags"] });
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
      setClientId("none");
      setStartDate("");
      setEndDate("");
      setTags([]);
      setTagInput("");
      setLogoFile(null);
      setLogoPreview(null);
      if (logoRef.current) logoRef.current.value = "";
      if (created?.id) {
        window.location.href = `/projects/${created.id}`;
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create project";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projectsApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-tags"] });
      toast.success("Project deleted");
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete project";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const raw = data?.data?.data ?? data?.data ?? [];
  const projects: Project[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: Project[] })?.data)
      ? (raw as { data: Project[] }).data
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Tags help separate clients (Vedha, F&S) and types (Web, App Dev, ERP)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>
                Add a project, tags, client, and timeline
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project logo</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => logoRef.current?.click()}
                    >
                      Upload logo
                    </Button>
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file && file.size > 5 * 1024 * 1024) {
                          toast.error("Logo must be 5 MB or smaller");
                          e.target.value = "";
                          return;
                        }
                        setLogoFile(file);
                        if (logoPreview) URL.revokeObjectURL(logoPreview);
                        setLogoPreview(file ? URL.createObjectURL(file) : null);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      PNG, JPG, or WebP · max 5 MB (optional)
                    </p>
                    {logoFile && (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setLogoFile(null);
                          if (logoPreview) URL.revokeObjectURL(logoPreview);
                          setLogoPreview(null);
                          if (logoRef.current) logoRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Website Redesign"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Tags
                </Label>
                <div className="rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
                  <TagChips
                    tags={tags}
                    onRemove={(t) => setTags((prev) => prev.filter((x) => x !== t))}
                    className="mb-1.5"
                  />
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                    onBlur={() => {
                      if (tagInput.trim()) addTag(tagInput);
                    }}
                    placeholder="Type tag and press Enter (e.g. Vedha, Web)"
                    className="border-0 shadow-none focus-visible:ring-0 h-8 px-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {TAG_SUGGESTIONS.filter(
                    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag(s)}
                      className="text-[11px] rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client yet</SelectItem>
                    {clients.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Filter by tag:</span>
        <Button
          size="sm"
          variant={tagFilter === "all" ? "default" : "outline"}
          onClick={() => setTagFilter("all")}
        >
          All
        </Button>
        {knownTags.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tagFilter === t ? "default" : "outline"}
            onClick={() => setTagFilter(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={tagFilter !== "all" ? "No projects with this tag" : "No projects yet"}
          description={
            tagFilter !== "all"
              ? "Try another tag, or clear the filter."
              : "Create your first project and add tags like Vedha, F&S, Web, or ERP."
          }
          actionLabel={tagFilter !== "all" ? "Clear filter" : "New Project"}
          onAction={
            tagFilter !== "all" ? () => setTagFilter("all") : () => setOpen(true)
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const clientName =
              typeof project.client === "string"
                ? project.client
                : project.client?.name;
            const progress = project.progressPercent ?? project.progress ?? 0;
            const taskCount =
              project._count?.clientTasks ?? project._count?.issues ?? 0;
            const projectTags = project.tags ?? [];
            return (
              <Card
                key={project.id}
                className="group relative overflow-hidden rounded-2xl transition-all hover:border-foreground/15 hover:shadow-md"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="absolute inset-0 z-0"
                  aria-label={`Open ${project.name}`}
                />
                <CardHeader className="relative z-10 pointer-events-none pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/50">
                        {project.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={project.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                        {clientName && (
                          <CardDescription className="truncate text-xs">
                            {clientName}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-auto shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label="Project actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>Overview</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}/board`}>Board</Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => router.push(`/projects/${project.id}?edit=1`)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(project)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {projectTags.length > 0 && (
                    <TagChips tags={projectTags} className="mt-2" />
                  )}
                </CardHeader>
                <CardContent className="relative z-10 pointer-events-none">
                  <div className="mb-3 flex items-center justify-between">
                    <Badge
                      variant={
                        statusVariant[project.status as keyof typeof statusVariant] ||
                        "secondary"
                      }
                      className="rounded-full font-normal"
                    >
                      {project.status.replace(/_/g, " ")}
                    </Badge>
                    {project.endDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" /> {formatDate(project.endDate)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{taskCount} client tasks</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> and its
              tasks, milestones, and board. Documents and invoices stay, but are unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Kanban,
  List,
  Zap,
  Users,
  Calendar,
  ArrowRight,
  LayoutDashboard,
  Link2,
  Copy,
  RefreshCw,
  ExternalLink,
  PowerOff,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { projectsApi } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";

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

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsDirty, setTagsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["project-tags"],
    queryFn: () => projectsApi.listTags(),
    retry: false,
  });

  const project = data?.data?.data ?? data?.data ?? null;

  useEffect(() => {
    if (!project || tagsDirty) return;
    setTags(Array.isArray(project.tags) ? project.tags : []);
  }, [project, tagsDirty]);

  const knownTags = useMemo(() => {
    const raw = tagsData?.data?.data ?? tagsData?.data ?? [];
    const fromApi = Array.isArray(raw) ? (raw as string[]) : [];
    return Array.from(new Set([...TAG_SUGGESTIONS, ...fromApi, ...tags])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [tagsData, tags]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project-tags"] });
  };

  const addTag = (raw: string) => {
    const t = raw.trim().slice(0, 40);
    if (!t) return;
    setTags((prev) => {
      if (prev.some((p) => p.toLowerCase() === t.toLowerCase())) return prev;
      return [...prev, t].slice(0, 20);
    });
    setTagInput("");
    setTagsDirty(true);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
    setTagsDirty(true);
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
      setTagsDirty(true);
    }
  };

  const saveTags = useMutation({
    mutationFn: () => projectsApi.update(id, { tags }),
    onSuccess: () => {
      setTagsDirty(false);
      invalidate();
      toast.success("Tags updated");
    },
    onError: () => toast.error("Could not update tags"),
  });

  const enablePortal = useMutation({
    mutationFn: () => projectsApi.enablePortal(id),
    onSuccess: () => {
      invalidate();
      toast.success("Client share link created");
    },
    onError: () => toast.error("Could not create share link"),
  });

  const rotatePortal = useMutation({
    mutationFn: () => projectsApi.rotatePortal(id),
    onSuccess: () => {
      invalidate();
      toast.success("New share link generated (old link no longer works)");
    },
    onError: () => toast.error("Could not rotate link"),
  });

  const disablePortal = useMutation({
    mutationFn: () => projectsApi.disablePortal(id),
    onSuccess: () => {
      invalidate();
      toast.success("Share link turned off");
    },
    onError: () => toast.error("Could not disable link"),
  });

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

  const shareUrl =
    project.portalEnabled && project.portalToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${project.portalToken}`
      : "";

  const navItems = [
    {
      href: `/projects/${id}/client-progress`,
      label: "Client Progress",
      icon: LayoutDashboard,
      desc: "Timeline, milestones, client tasks & share link",
      primary: true,
    },
    {
      href: `/projects/${id}/board`,
      label: "Board",
      icon: Kanban,
      desc: "Kanban board — create tasks, Testing & more",
    },
    {
      href: `/projects/${id}/backlog`,
      label: "Backlog",
      icon: List,
      desc: "Internal task list",
    },
    {
      href: `/projects/${id}/sprints`,
      label: "Sprints",
      icon: Zap,
      desc: "Sprint planning",
    },
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
          {tags.length > 0 && !tagsDirty && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[11px] font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          )}
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> Tags
          </CardTitle>
          <CardDescription>
            Mark client brand (Vedha, F&S) or type (Web, App Dev, ERP). Used to filter the projects list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
            <div className="flex flex-wrap gap-1.5 mb-1.5 empty:mb-0">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] font-normal gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={() => {
                if (tagInput.trim()) addTag(tagInput);
              }}
              placeholder="Type tag and press Enter"
              className="border-0 shadow-none focus-visible:ring-0 h-8 px-1"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {knownTags
              .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
              .slice(0, 16)
              .map((s) => (
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
          {tagsDirty && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveTags.mutate()} disabled={saveTags.isPending}>
                {saveTags.isPending ? "Saving…" : "Save tags"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTags(Array.isArray(project.tags) ? project.tags : []);
                  setTagInput("");
                  setTagsDirty(false);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share client link — no login required for client */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Client share link
          </CardTitle>
          <CardDescription>
            Generate a link and send it to the client (WhatsApp / email). They open
            it and see this project&apos;s details — no login required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!project.portalEnabled || !project.portalToken ? (
            <Button
              onClick={() => enablePortal.mutate()}
              disabled={enablePortal.isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              {enablePortal.isPending ? "Creating link…" : "Create client link"}
            </Button>
          ) : (
            <>
              <div className="rounded-lg border bg-background px-3 py-2 text-xs break-all font-mono">
                {shareUrl}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Client link copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rotatePortal.mutate()}
                  disabled={rotatePortal.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> New link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disablePortal.mutate()}
                  disabled={disablePortal.isPending}
                >
                  <PowerOff className="h-3.5 w-3.5 mr-1" /> Turn off
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Public page shows: overview, timeline, milestones, client tasks,
                work items, and project documents.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          {project.description && (
            <CardDescription>{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Client progress</p>
              <p className="text-2xl font-bold font-display text-primary">
                {progress}%
              </p>
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

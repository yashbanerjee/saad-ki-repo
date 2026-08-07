"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  PowerOff,
  RefreshCw,
  Tag,
  Upload,
  Users,
  X,
  Kanban,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientsApi, documentsApi, projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
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

const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
];

function CreateClientLoginButton({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => clientsApi.createLogin(clientId, {}),
    onSuccess: (res) => {
      const result = res?.data?.data ?? res?.data ?? {};
      onDone();
      const loginWith = result.loginWith || result.email || result.phone;
      const temp = result.temporaryPassword;
      toast.success(
        temp
          ? `Login created for ${loginWith}. Temp password: ${temp}`
          : `Login created for ${loginWith}`,
        { duration: 12000 },
      );
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not create login";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Creating…" : "Create client login"}
    </Button>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsDirty, setTagsDirty] = useState(false);
  const [settings, setSettings] = useState({
    name: "",
    description: "",
    status: "PLANNING",
    clientId: "none",
    startDate: "",
    endDate: "",
  });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [shareClientUpload, setShareClientUpload] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "for-project"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    retry: false,
  });

  const project = data?.data?.data ?? data?.data ?? null;

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  useEffect(() => {
    if (!project) return;
    if (!tagsDirty) setTags(Array.isArray(project.tags) ? project.tags : []);
    if (!settingsDirty) {
      setSettings({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "PLANNING",
        clientId: project.clientId || project.client?.id || "none",
        startDate: toDateInput(project.startDate),
        endDate: toDateInput(project.endDate),
      });
    }
  }, [project, tagsDirty, settingsDirty]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project-tags"] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const updateProject = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.update(id, payload),
    onSuccess: () => {
      setTagsDirty(false);
      setSettingsDirty(false);
      invalidate();
      toast.success("Project saved");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not save";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
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

  const uploadDoc = useMutation({
    mutationFn: (file: File) =>
      documentsApi.upload(file, {
        name: file.name,
        projectId: id,
        clientId:
          settings.clientId !== "none"
            ? settings.clientId
            : project?.clientId || undefined,
        isClientVisible: shareClientUpload,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Document uploaded");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Upload failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ docId, visible }: { docId: string; visible: boolean }) =>
      documentsApi.update(docId, { isClientVisible: visible }),
    onSuccess: () => {
      invalidate();
      toast.success("Visibility updated");
    },
    onError: () => toast.error("Could not update visibility"),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => documentsApi.remove(docId),
    onSuccess: () => {
      invalidate();
      toast.success("Document deleted");
    },
    onError: () => toast.error("Could not delete"),
  });

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

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
      setTagsDirty(true);
    }
  };

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

  const client = project.client;
  const documents = Array.isArray(project.documents) ? project.documents : [];
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const issues = Array.isArray(project.issues) ? project.issues : [];
  const progress = project.progressPercent ?? 0;

  const shareUrl =
    project.portalEnabled && project.portalToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${project.portalToken}`
      : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-bold">{project.name}</h1>
            {project.status && <Badge variant="success">{project.status}</Badge>}
            {project.key && (
              <Badge variant="outline" className="font-mono text-xs">
                {project.key}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {client?.name
              ? `Client: ${client.name}`
              : "No client linked yet — assign one below"}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[11px] font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/projects/${id}/board`}>
              <Kanban className="h-4 w-4 mr-1" /> Project board
            </Link>
          </Button>
        </div>
      </div>

      {/* Work at a glance */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-2xl font-bold font-display text-primary">{progress}%</p>
            <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Milestones</p>
            <p className="text-2xl font-bold font-display">{milestones.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Group work like sprints
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Board tasks</p>
            <p className="text-2xl font-bold font-display">{issues.length}</p>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href={`/projects/${id}/board`}>
                Open board <ArrowRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Client share link */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Client share link
          </CardTitle>
          <CardDescription>
            Status:{" "}
            <span className="font-medium text-foreground">
              {project.portalEnabled && project.portalToken ? "Active" : "Off"}
            </span>
            . Send the link so the client can see progress, tasks, and shared documents — no
            login required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!project.portalEnabled || !project.portalToken ? (
            <Button onClick={() => enablePortal.mutate()} disabled={enablePortal.isPending}>
              <Link2 className="h-4 w-4 mr-1" />
              {enablePortal.isPending ? "Creating…" : "Create client link"}
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
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Client profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Client profile
            </CardTitle>
            <CardDescription>Link a CRM client and see contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Assigned client</Label>
              <Select
                value={settings.clientId}
                onValueChange={(v) => {
                  setSettings((s) => ({ ...s, clientId: v }));
                  setSettingsDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {client ? (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">{client.name}</p>
                {client.email && (
                  <p className="text-muted-foreground text-xs">{client.email}</p>
                )}
                {client.phone && (
                  <p className="text-muted-foreground text-xs">{client.phone}</p>
                )}
                {client.companyName && (
                  <p className="text-muted-foreground text-xs">{client.companyName}</p>
                )}
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/clients/${client.id}`}>Open client record</Link>
                  </Button>
                  {!client.userId && (
                    <CreateClientLoginButton clientId={client.id} onDone={invalidate} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick a client above and save settings to attach their profile.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Settings + tags */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project settings</CardTitle>
            <CardDescription>Name, timeline, status — no billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={settings.name}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, name: e.target.value }));
                  setSettingsDirty(true);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={settings.status}
                onValueChange={(v) => {
                  setSettings((s) => ({ ...s, status: v }));
                  setSettingsDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Start
                </Label>
                <Input
                  type="date"
                  value={settings.startDate}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, startDate: e.target.value }));
                    setSettingsDirty(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="date"
                  value={settings.endDate}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, endDate: e.target.value }));
                    setSettingsDirty(true);
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={settings.description}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, description: e.target.value }));
                  setSettingsDirty(true);
                }}
                rows={3}
              />
            </div>
            {settingsDirty && (
              <Button
                size="sm"
                disabled={updateProject.isPending || !settings.name.trim()}
                onClick={() =>
                  updateProject.mutate({
                    name: settings.name.trim(),
                    description: settings.description || undefined,
                    status: settings.status,
                    clientId: settings.clientId === "none" ? null : settings.clientId,
                    startDate: settings.startDate || null,
                    endDate: settings.endDate || null,
                  })
                }
              >
                {updateProject.isPending ? "Saving…" : "Save settings"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> Tags
          </CardTitle>
          <CardDescription>
            Client brand (Vedha, F&S) or type (Web, App Dev, ERP)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      setTags((p) => p.filter((x) => x !== tag));
                      setTagsDirty(true);
                    }}
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
            {TAG_SUGGESTIONS.filter(
              (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="text-[11px] rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted"
              >
                + {s}
              </button>
            ))}
          </div>
          {tagsDirty && (
            <Button
              size="sm"
              disabled={updateProject.isPending}
              onClick={() => updateProject.mutate({ tags })}
            >
              Save tags
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Client documents */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Client documents
              </CardTitle>
              <CardDescription>
                Upload files for this project. Toggle “Show to client” for the share portal.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={shareClientUpload}
                  onChange={(e) => setShareClientUpload(e.target.checked)}
                />
                New uploads visible to client
              </label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadDoc.mutate(f);
                }}
              />
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadDoc.isPending}
              >
                {uploadDoc.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No project documents yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {documents.map(
                (doc: {
                  id: string;
                  name: string;
                  originalName?: string;
                  isClientVisible?: boolean;
                  size?: number;
                  mimeType?: string;
                  createdAt?: string;
                }) => (
                  <li
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {doc.originalName || doc.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[doc.mimeType, doc.createdAt ? formatDate(doc.createdAt) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={doc.isClientVisible ? "default" : "outline"}
                        onClick={() =>
                          toggleVisibility.mutate({
                            docId: doc.id,
                            visible: !doc.isClientVisible,
                          })
                        }
                        title={
                          doc.isClientVisible
                            ? "Visible on client portal — click to hide"
                            : "Hidden from client — click to show"
                        }
                      >
                        {doc.isClientVisible ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Client can see
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this document?")) deleteDoc.mutate(doc.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Milestones preview */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Milestones</CardTitle>
            <CardDescription>
              Each milestone holds its own tasks on the board (like sprints)
            </CardDescription>
          </div>
          <Button size="sm" asChild>
            <Link href={`/projects/${id}/board`}>Manage on board</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones yet — create them on the project board.
            </p>
          ) : (
            <ul className="space-y-2">
              {milestones.map(
                (m: {
                  id: string;
                  name: string;
                  status?: string;
                  dueDate?: string;
                  _count?: { issues?: number };
                }) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.status}
                        {m.dueDate ? ` · due ${formatDate(m.dueDate)}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {m._count?.issues ??
                        issues.filter(
                          (i: { milestoneId?: string }) => i.milestoneId === m.id,
                        ).length}{" "}
                      tasks
                    </Badge>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

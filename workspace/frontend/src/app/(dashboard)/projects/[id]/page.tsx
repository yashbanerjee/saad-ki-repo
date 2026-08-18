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
import { documentsApi, projectsApi, usersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { hasRole, useAuthStore } from "@/lib/auth-store";
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

/* Client profile helper — restore with Client profile card
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
*/

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const canManageMembers = hasRole(user, ["admin", "manager"]);

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
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("developer");

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "for-project-members"],
    queryFn: () => usersApi.list({ limit: 100 }),
    enabled: canManageMembers,
    retry: false,
  });

  const project = data?.data?.data ?? data?.data ?? null;

  const companyUsers = useMemo(() => {
    const raw = usersData?.data?.data ?? usersData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [usersData]);

  const members = useMemo(() => {
    return Array.isArray(project?.members) ? project.members : [];
  }, [project]);

  const memberUserIds = useMemo(
    () => new Set(members.map((m: { userId?: string; user?: { id?: string } }) => m.user?.id || m.userId)),
    [members],
  );

  const availableUsers = useMemo(
    () =>
      companyUsers.filter(
        (u: { id: string }) => u.id && !memberUserIds.has(u.id),
      ),
    [companyUsers, memberUserIds],
  );

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

  const uploadLogo = useMutation({
    mutationFn: (file: File) => projectsApi.uploadLogo(id, file),
    onSuccess: () => {
      invalidate();
      toast.success("Project logo updated");
      if (logoRef.current) logoRef.current.value = "";
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Logo upload failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
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

  const addMember = useMutation({
    mutationFn: () =>
      projectsApi.addMember(id, {
        userId: addMemberUserId,
        role: addMemberRole,
      }),
    onSuccess: () => {
      setAddMemberUserId("");
      setAddMemberRole("developer");
      invalidate();
      toast.success("Team member added (view + assigned task status only)");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not add member";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Member removed");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not remove member";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
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
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-14 w-14 shrink-0 rounded-xl border bg-muted/40 overflow-hidden flex items-center justify-center">
            {project.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.avatar}
                alt={`${project.name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {(project.name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
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
        </div>
      </div>

      {/* Work at a glance + Kanban */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
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
        <Card className="bg-muted/50 sm:col-span-2">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between h-full">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Kanban board for admins</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rename columns, add or delete columns, create tasks with documents, and see
                who created each task (Client / Admin / Employee) on the project board.
              </p>
            </div>
            <Button size="sm" asChild className="shrink-0 rounded-full">
              <Link href={`/projects/${id}/board`}>
                Manage board <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full min-w-0 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Team on this project
            </CardTitle>
            <CardDescription>
              They only see this project. Status changes are limited to assigned
              tasks; everything else stays with the owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <ul className="space-y-1.5">
              {members.length === 0 ? (
                <li className="text-sm text-muted-foreground">No members yet.</li>
              ) : (
                members.map(
                  (m: {
                    id?: string;
                    role?: string;
                    userId?: string;
                    user?: {
                      id: string;
                      firstName?: string;
                      lastName?: string;
                      email?: string;
                    };
                  }) => {
                    const uid = m.user?.id || m.userId || "";
                    const name =
                      `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                      m.user?.email ||
                      uid;
                    const roleLabel = (m.role || "member").replace(/_/g, " ");
                    return (
                      <li
                        key={m.id || uid}
                        className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground capitalize truncate">
                            {roleLabel}
                            {m.user?.email ? ` · ${m.user.email}` : ""}
                          </p>
                        </div>
                        {canManageMembers && m.role !== "owner" && uid ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 p-0"
                            disabled={removeMember.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove ${name} from this project?`)) {
                                removeMember.mutate(uid);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </li>
                    );
                  },
                )
              )}
            </ul>

            {canManageMembers && (
              <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs">Add developer / freelancer</Label>
                  <Select
                    value={addMemberUserId || undefined}
                    onValueChange={setAddMemberUserId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select team user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No more users to add
                        </SelectItem>
                      ) : (
                        availableUsers.map(
                          (u: {
                            id: string;
                            firstName?: string;
                            lastName?: string;
                            email?: string;
                          }) => (
                            <SelectItem key={u.id} value={u.id}>
                              {`${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                                u.email}
                            </SelectItem>
                          ),
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full space-y-1 sm:w-32">
                  <Label className="text-xs">Role</Label>
                  <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!addMemberUserId || addMember.isPending}
                  onClick={() => addMember.mutate()}
                >
                  {addMember.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-w-0 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Client share link
              <Badge
                variant={
                  project.portalEnabled && project.portalToken ? "success" : "outline"
                }
                className="ml-auto text-[10px] font-normal"
              >
                {project.portalEnabled && project.portalToken ? "Active" : "Off"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Client can view progress, tasks, and documents — no login.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {!project.portalEnabled || !project.portalToken ? (
              <Button
                className="mt-auto w-full sm:w-auto"
                onClick={() => enablePortal.mutate()}
                disabled={enablePortal.isPending}
              >
                <Link2 className="h-4 w-4 mr-1" />
                {enablePortal.isPending ? "Creating…" : "Create client link"}
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">
                    {shareUrl}
                  </div>
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Client link copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
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
      </div>

      {/* Client profile hidden for now
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Client profile
          </CardTitle>
          <CardDescription>Link a CRM client and see contact details</CardDescription>
        </CardHeader>
      </Card>
      */}

      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Project settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-10 w-10 rounded-lg border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0">
              {project.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-primary">
                  {(project.name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={uploadLogo.isPending}
              onClick={() => logoRef.current?.click()}
            >
              {uploadLogo.isPending ? "Uploading…" : "Change logo"}
            </Button>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Logo must be 5 MB or smaller");
                  e.target.value = "";
                  return;
                }
                uploadLogo.mutate(file);
              }}
            />
            <div className="grid flex-1 grid-cols-2 gap-2 min-w-[200px] sm:max-w-xs">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Start
                </Label>
                <Input
                  type="date"
                  className="h-9"
                  value={settings.startDate}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, startDate: e.target.value }));
                    setSettingsDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={settings.endDate}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, endDate: e.target.value }));
                    setSettingsDirty(true);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-9"
                value={settings.name}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, name: e.target.value }));
                  setSettingsDirty(true);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={settings.status}
                onValueChange={(v) => {
                  setSettings((s) => ({ ...s, status: v }));
                  setSettingsDirty(true);
                }}
              >
                <SelectTrigger className="h-9">
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
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={settings.description}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, description: e.target.value }));
                  setSettingsDirty(true);
                }}
                rows={3}
                className="min-h-[72px] resize-y text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags
              </Label>
              <div className="rounded-md border px-2 py-1 focus-within:ring-1 focus-within:ring-ring min-h-[72px]">
                <div className="flex flex-wrap gap-1 mb-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] gap-0.5 pr-1 h-5">
                      {tag}
                      <button
                        type="button"
                        onClick={() => {
                          setTags((p) => p.filter((x) => x !== tag));
                          setTagsDirty(true);
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
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
                  placeholder="Type tag, press Enter"
                  className="border-0 shadow-none focus-visible:ring-0 h-7 px-1 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {TAG_SUGGESTIONS.filter(
                  (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="text-[10px] rounded-full border px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(settingsDirty || tagsDirty) && (
            <Button
              size="sm"
              className="h-8"
              disabled={updateProject.isPending || !settings.name.trim()}
              onClick={() =>
                updateProject.mutate({
                  name: settings.name.trim(),
                  description: settings.description || undefined,
                  status: settings.status,
                  clientId: settings.clientId === "none" ? null : settings.clientId,
                  startDate: settings.startDate || null,
                  endDate: settings.endDate || null,
                  tags,
                })
              }
            >
              {updateProject.isPending ? "Saving…" : "Save settings"}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <Card className="flex h-full min-w-0 flex-col">
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
                  if (!f) return;
                  if (f.size > 100 * 1024 * 1024) {
                    toast.error(`${f.name} is over 100 MB`);
                    e.target.value = "";
                    return;
                  }
                  uploadDoc.mutate(f);
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
        <CardContent className="flex-1">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
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

      <Card className="flex h-full min-w-0 flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
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
        <CardContent className="flex-1">
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
    </div>
  );
}

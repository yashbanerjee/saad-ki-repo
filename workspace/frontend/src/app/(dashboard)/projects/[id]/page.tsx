"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Loader2,
  PowerOff,
  RefreshCw,
  Settings,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  defaultColumns,
  type KanbanColumn,
  type KanbanTask,
} from "@/components/features/KanbanBoard";
import { ProjectHubBoard } from "@/components/features/ProjectHubBoard";
import { activityApi, documentsApi, projectsApi, usersApi } from "@/lib/api";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
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

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatShortDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function personName(p?: { firstName?: string; lastName?: string } | string | null) {
  if (!p) return "";
  if (typeof p === "string") return p;
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

function prettyProjectStatus(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "In progress";
  if (s === "PLANNING") return "Planning";
  if (s === "ON_HOLD") return "On hold";
  if (s === "COMPLETED") return "Done";
  return (status || "").replace(/_/g, " ");
}

function prettyIssueStatus(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "TODO" || s === "BACKLOG") return "Not started";
  if (s === "IN_PROGRESS") return "In progress";
  if (s === "TESTING" || s === "IN_REVIEW") return "In review";
  if (s === "DONE") return "Done";
  if (s === "BLOCKED") return "Blocked";
  return (status || "").replace(/_/g, " ");
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

function milestoneDot(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "DONE") return "bg-foreground";
  if (s === "IN_PROGRESS") return "bg-[#E5FF00]";
  return "border border-foreground/30 bg-transparent";
}

function milestoneLabel(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "DONE") return "Signed off";
  if (s === "IN_PROGRESS") return "In progress";
  return "Not started";
}

async function downloadDocument(doc: { id: string; name: string; originalName?: string }) {
  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const res = await documentsApi.download(doc.id);
  const payload = res.data?.data ?? res.data;
  if (payload?.kind === "inline" && payload.content) {
    triggerBlobDownload(
      new Blob([payload.content], { type: payload.mimeType || "text/plain" }),
      payload.name || `${doc.name}.txt`,
    );
    return;
  }
  if (payload?.kind === "base64" && payload.content) {
    const binary = atob(payload.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    triggerBlobDownload(
      new Blob([bytes], { type: payload.mimeType || "application/octet-stream" }),
      payload.name || doc.originalName || doc.name,
    );
    return;
  }
  if (payload?.url) {
    window.open(payload.url, "_blank", "noopener,noreferrer");
    return;
  }
  throw new Error("unavailable");
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
  const [manageOpen, setManageOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    retry: false,
  });

  const { data: boardRes } = useQuery({
    queryKey: ["project-board", id],
    queryFn: () => projectsApi.getBoard(id),
    retry: false,
    enabled: Boolean(id),
  });

  const { data: activityRes } = useQuery({
    queryKey: ["activity", id],
    queryFn: () => activityApi.list({ projectId: id, limit: 6 }),
    retry: false,
    enabled: Boolean(id),
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
    () =>
      new Set(
        members.map(
          (m: { userId?: string; user?: { id?: string } }) => m.user?.id || m.userId,
        ),
      ),
    [members],
  );

  const availableUsers = useMemo(
    () => companyUsers.filter((u: { id: string }) => u.id && !memberUserIds.has(u.id)),
    [companyUsers, memberUserIds],
  );

  const boardColumns: KanbanColumn[] = useMemo(() => {
    const boardData = boardRes?.data?.data ?? boardRes?.data;
    if (Array.isArray(boardData?.columns) && boardData.columns.length > 0) {
      return boardData.columns.map((col: KanbanColumn & { tasks?: KanbanTask[] }) => ({
        ...col,
        title: col.title || col.id?.replace(/_/g, " ") || "Column",
        tasks: Array.isArray(col.tasks) ? col.tasks : [],
      }));
    }
    return defaultColumns.map((c) => ({ ...c, tasks: [] }));
  }, [boardRes]);

  const activity = useMemo(() => {
    const body = activityRes?.data?.data ?? activityRes?.data;
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.data)) return body.data;
    return [];
  }, [activityRes]);

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
    queryClient.invalidateQueries({ queryKey: ["project-board", id] });
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

  const toggleClientTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      projectsApi.updateClientTask(id, taskId, { status }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Could not update checklist"),
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

  const handleTaskMove = async (taskId: string, _from: string, toColumn: string) => {
    try {
      await projectsApi.updateTaskStatus(id, taskId, toColumn);
      toast.success("Status updated");
      invalidate();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update status";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      invalidate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
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
  const clientTasks = Array.isArray(project.clientTasks) ? project.clientTasks : [];
  const progress = project.progressPercent ?? 0;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const shareUrl =
    project.portalEnabled && project.portalToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${project.portalToken}`
      : "";

  const openIssues = issues.filter(
    (i: { status?: string }) => i.status && i.status !== "DONE" && i.status !== "CANCELLED",
  );
  const dueThisWeek = openIssues.filter((i: { dueDate?: string }) => {
    if (!i.dueDate) return false;
    const d = new Date(i.dueDate);
    return d >= now && d <= weekAhead;
  }).length;

  const waitingIssues = openIssues.filter((i: { status?: string; dueDate?: string; priority?: string }) => {
    const s = (i.status || "").toUpperCase();
    const overdue = i.dueDate ? new Date(i.dueDate) < now : false;
    const hot = ["HIGH", "HIGHEST", "CRITICAL"].includes((i.priority || "").toUpperCase());
    return s === "TESTING" || s === "IN_REVIEW" || s === "BLOCKED" || overdue || hot;
  });
  const waiting = waitingIssues[0] as
    | {
        id: string;
        title: string;
        dueDate?: string;
        status?: string;
      }
    | undefined;
  const oldestWaitingDays = waitingIssues.reduce((max: number, i: { dueDate?: string }) => {
    if (!i.dueDate) return max;
    const overdue = daysBetween(new Date(i.dueDate), now);
    return overdue > max ? overdue : max;
  }, 0);

  const doneMilestones = milestones.filter((m: { status?: string }) => m.status === "DONE").length;
  const phase =
    milestones.length === 0
      ? 0
      : Math.min(doneMilestones + (doneMilestones < milestones.length ? 1 : 0), milestones.length);

  const daysToLaunch = project.endDate ? daysBetween(now, new Date(project.endDate)) : null;

  const checklist = (
    clientTasks.length
      ? clientTasks.map(
          (t: { id: string; title: string; status?: string; updatedAt?: string }) => ({
            id: t.id,
            title: t.title,
            done: t.status === "DONE",
            date: t.updatedAt,
            kind: "client" as const,
          }),
        )
      : issues.slice(0, 6).map(
          (i: { id: string; title: string; status?: string; dueDate?: string }) => ({
            id: i.id,
            title: i.title,
            done: i.status === "DONE",
            date: i.dueDate,
            kind: "issue" as const,
          }),
        )
  ) as {
    id: string;
    title: string;
    done: boolean;
    date?: string;
    kind: "client" | "issue";
  }[];

  const setupChecklist =
    checklist.length === 0
      ? [
          { id: "client", title: "Link a client", done: Boolean(client), date: undefined },
          {
            id: "link",
            title: "Create client share link",
            done: Boolean(project.portalEnabled && project.portalToken),
            date: undefined,
          },
          {
            id: "docs",
            title: "Upload project documents",
            done: documents.length > 0,
            date: undefined,
          },
          {
            id: "ms",
            title: "Add first milestone",
            done: milestones.length > 0,
            date: undefined,
          },
        ]
      : [];

  const shownChecklist = checklist.length ? checklist : setupChecklist;
  const checklistDone = shownChecklist.filter((i) => i.done).length;
  const checklistPct = shownChecklist.length
    ? Math.round((checklistDone / shownChecklist.length) * 100)
    : 0;

  const briefDoc = documents[0] as
    | { id: string; name: string; originalName?: string; storageUrl?: string | null }
    | undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.status && (
              <Badge variant="secondary" className="rounded-full font-normal">
                {prettyProjectStatus(project.status)}
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {project.description ||
              (client?.name
                ? `Delivery workspace for ${client.name}.`
                : "Project workspace for progress, files, and milestones.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={async () => {
              if (briefDoc) {
                try {
                  await downloadDocument(briefDoc);
                } catch {
                  toast.error("Could not download");
                }
                return;
              }
              if (shareUrl) {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Client link copied");
                return;
              }
              setManageOpen(true);
            }}
          >
            <Download className="h-4 w-4" />
            {briefDoc ? "Download brief" : "Copy client link"}
          </Button>
          <Button asChild>
            <Link href={`/projects/${id}/board`}>Open board</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setManageOpen(true)} aria-label="Project settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Project progress",
            value: `${progress}%`,
            hint: milestones.length ? `Phase ${phase} of ${milestones.length}` : "No milestones yet",
          },
          {
            label: "Open work items",
            value: String(openIssues.length),
            hint: `${dueThisWeek} due this week`,
          },
          {
            label: "Waiting on you",
            value: String(waitingIssues.length),
            hint: oldestWaitingDays > 0 ? `Oldest: ${oldestWaitingDays} days` : "Nothing overdue",
          },
          {
            label: "Days to launch",
            value: daysToLaunch == null ? "—" : String(Math.max(0, daysToLaunch)),
            hint: project.endDate ? `Target ${formatShortDate(project.endDate)}` : "No end date",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold">Onboarding checklist</CardTitle>
              <span className="text-sm text-muted-foreground">{checklistPct}%</span>
            </CardHeader>
            <CardContent>
              <Progress value={checklistPct} className="mb-4 h-2.5" />
              <ul>
                {shownChecklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
                  >
                    <Checkbox
                      checked={item.done}
                      disabled={
                        !("kind" in item) ||
                        toggleClientTask.isPending
                      }
                      onCheckedChange={(checked) => {
                        if (!("kind" in item)) return;
                        if (item.kind === "client") {
                          toggleClientTask.mutate({
                            taskId: item.id,
                            status: checked === true ? "DONE" : "TODO",
                          });
                          return;
                        }
                        void handleTaskMove(
                          item.id,
                          "",
                          checked === true ? "DONE" : "TODO",
                        );
                      }}
                    />
                    <span className={cn("flex-1 text-sm", item.done && "text-foreground")}>
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.date
                        ? item.done
                          ? formatShortDate(item.date)
                          : `due ${formatShortDate(item.date)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Tabs defaultValue="board">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-10 rounded-full bg-muted p-1">
                <TabsTrigger value="board" className="rounded-full px-4">
                  Board
                </TabsTrigger>
                <TabsTrigger value="list" className="rounded-full px-4">
                  List
                </TabsTrigger>
                <TabsTrigger value="files" className="rounded-full px-4">
                  Files
                </TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-full px-4">
                  Timeline
                </TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">
                Drag cards between columns to re-prioritize.
              </p>
            </div>

            <TabsContent value="board" className="mt-6">
              <ProjectHubBoard columns={boardColumns} onTaskMove={handleTaskMove} />
            </TabsContent>

            <TabsContent value="list" className="mt-6">
              {issues.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No work items yet.</p>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {issues.map(
                          (issue: {
                            id: string;
                            key?: string;
                            title: string;
                            status?: string;
                            dueDate?: string;
                            assignee?: { firstName?: string; lastName?: string };
                          }) => (
                            <TableRow key={issue.id}>
                              <TableCell>
                                <Link href={`/issues/${issue.id}`} className="font-medium hover:underline">
                                  {issue.key ? `${issue.key} · ` : ""}
                                  {issue.title}
                                </Link>
                                {personName(issue.assignee) && (
                                  <p className="text-xs text-muted-foreground">
                                    {personName(issue.assignee)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{prettyIssueStatus(issue.status)}</Badge>
                              </TableCell>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">
                                {formatShortDate(issue.dueDate) || "—"}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={shareClientUpload}
                    onCheckedChange={(checked) => setShareClientUpload(checked === true)}
                  />
                  New uploads visible to client
                </label>
                <div>
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
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
                    {uploadDoc.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload
                  </Button>
                </div>
              </div>
              {documents.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No project documents yet.</p>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead className="hidden sm:table-cell">Date</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map(
                          (doc: {
                            id: string;
                            name: string;
                            originalName?: string;
                            isClientVisible?: boolean;
                            createdAt?: string;
                          }) => (
                            <TableRow key={doc.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{doc.originalName || doc.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">
                                {doc.createdAt ? formatShortDate(doc.createdAt) : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      toggleVisibility.mutate({
                                        docId: doc.id,
                                        visible: !doc.isClientVisible,
                                      })
                                    }
                                  >
                                    {doc.isClientVisible ? (
                                      <Eye className="h-4 w-4" />
                                    ) : (
                                      <EyeOff className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      if (confirm("Delete this document?")) deleteDoc.mutate(doc.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-6">
              {milestones.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No milestones yet — create them on the project board.
                </p>
              ) : (
                <ul className="space-y-4">
                  {milestones.map(
                    (m: {
                      id: string;
                      name: string;
                      status?: string;
                      dueDate?: string;
                      _count?: { issues?: number };
                    }) => (
                      <li key={m.id} className="flex items-start gap-3">
                        <span
                          className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", milestoneDot(m.status))}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{milestoneLabel(m.status)}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {m.dueDate ? formatShortDate(m.dueDate) : "—"}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          {!snoozed && waiting && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E5FF00]" />
                  <div>
                    <p className="text-sm font-semibold">Waiting on you</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {waiting.title}
                      {waiting.dueDate ? ` · due ${formatShortDate(waiting.dueDate)}` : ""}.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/issues/${waiting.id}`}>Review task</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSnoozed(true)}>
                    Snooze
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="mb-4 text-base font-semibold">Milestones</h2>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-4">
                {milestones.map(
                  (m: { id: string; name: string; status?: string; dueDate?: string }) => (
                    <li key={m.id} className="flex items-start gap-3">
                      <span
                        className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", milestoneDot(m.status))}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{milestoneLabel(m.status)}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {m.dueDate ? formatShortDate(m.dueDate) : "—"}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-base font-semibold">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map(
                  (row: {
                    id?: string;
                    message?: string;
                    createdAt?: string;
                    user?: { firstName?: string; lastName?: string };
                  }) => {
                    const name = personName(row.user) || "Someone";
                    return (
                      <li key={row.id || row.createdAt} className="flex gap-3">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-muted text-[10px]">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug">
                            <span className="font-medium">{name}</span>{" "}
                            <span className="text-muted-foreground">{row.message}</span>
                          </p>
                          {row.createdAt && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatRelativeTime(row.createdAt)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Project settings</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-8">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {project.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold">
                      {(project.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
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
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">
                    <Calendar className="mr-1 inline h-3 w-3" /> Start
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
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={settings.description}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, description: e.target.value }));
                    setSettingsDirty(true);
                  }}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  <Tag className="mr-1 inline h-3 w-3" /> Tags
                </Label>
                <div className="min-h-[72px] rounded-md border px-2 py-1">
                  <div className="mb-1 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="h-5 gap-0.5 pr-1 text-[10px]">
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
                    className="h-7 border-0 px-1 shadow-none focus-visible:ring-0"
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
                      className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
              {(settingsDirty || tagsDirty) && (
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
                      tags,
                    })
                  }
                >
                  {updateProject.isPending ? "Saving…" : "Save settings"}
                </Button>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Team
              </h3>
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
                      return (
                        <li
                          key={m.id || uid}
                          className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            <p className="truncate text-xs capitalize text-muted-foreground">
                              {(m.role || "member").replace(/_/g, " ")}
                            </p>
                          </div>
                          {canManageMembers && m.role !== "owner" && uid ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">Add member</Label>
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
                                {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
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
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4" /> Client share link
                <Badge
                  variant={project.portalEnabled && project.portalToken ? "success" : "outline"}
                  className="ml-auto text-[10px] font-normal"
                >
                  {project.portalEnabled && project.portalToken ? "Active" : "Off"}
                </Badge>
              </h3>
              {!project.portalEnabled || !project.portalToken ? (
                <Button onClick={() => enablePortal.mutate()} disabled={enablePortal.isPending}>
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
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        toast.success("Client link copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Preview
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rotatePortal.mutate()}
                      disabled={rotatePortal.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> New link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disablePortal.mutate()}
                      disabled={disablePortal.isPending}
                    >
                      <PowerOff className="h-3.5 w-3.5" /> Turn off
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

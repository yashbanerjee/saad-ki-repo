"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  Layers,
  Paperclip,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KanbanBoard,
  defaultColumns,
  type KanbanColumn,
  type KanbanTask,
} from "@/components/features/KanbanBoard";
import { issuesApi, projectsApi } from "@/lib/api";
import { hasRole, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

type Milestone = {
  id: string;
  name: string;
  status?: string;
  dueDate?: string | null;
  _count?: { issues?: number };
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadAllAttachments(issueId: string, files: File[]) {
  let uploaded = 0;
  let failed = 0;
  for (const file of files) {
    try {
      await issuesApi.uploadAttachment(issueId, file);
      uploaded += 1;
    } catch {
      failed += 1;
    }
  }
  return { uploaded, failed };
}

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const canManageColumns = hasRole(user, ["admin", "manager"]);
  const confirm = useConfirm();
  const createFileRef = useRef<HTMLInputElement>(null);

  const [milestoneFilter, setMilestoneFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState("TODO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [type, setType] = useState("TASK");
  const [milestoneId, setMilestoneId] = useState<string>("none");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("default");
  const [createFiles, setCreateFiles] = useState<File[]>([]);

  const [msOpen, setMsOpen] = useState(false);
  const [msName, setMsName] = useState("");
  const [msDue, setMsDue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["project-board", projectId],
    queryFn: () => projectsApi.getBoard(projectId),
    retry: 1,
    enabled: Boolean(accessToken && projectId),
  });

  const { data: projectDetail } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(accessToken && projectId && canManageColumns),
  });

  const boardData = data?.data?.data ?? data?.data;
  const projectMembers = useMemo(() => {
    const raw = projectDetail?.data?.data ?? projectDetail?.data;
    const members = raw?.members;
    return Array.isArray(members) ? members : [];
  }, [projectDetail]);
  const milestones: Milestone[] = useMemo(() => {
    const raw = boardData?.milestones;
    return Array.isArray(raw) ? raw : [];
  }, [boardData]);

  const initialColumns: KanbanColumn[] = useMemo(() => {
    let columns: KanbanColumn[] = [];
    if (Array.isArray(boardData?.columns) && boardData.columns.length > 0) {
      columns = boardData.columns.map((col: KanbanColumn & { tasks?: KanbanTask[] }) => ({
        ...col,
        title: col.title || col.id?.replace(/_/g, " ") || "Column",
        tasks: Array.isArray(col.tasks) ? col.tasks : [],
      }));
    } else {
      columns = defaultColumns.map((c) => ({ ...c, tasks: [] }));
    }

    if (milestoneFilter === "all") return columns;
    if (milestoneFilter === "none") {
      return columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => !t.milestoneId),
      }));
    }
    return columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => t.milestoneId === milestoneFilter),
    }));
  }, [boardData, milestoneFilter]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const addCreateFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const next: File[] = [...createFiles];
    for (const file of incoming) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is over 100 MB`);
        continue;
      }
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} files per task`);
        break;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    setCreateFiles(next);
    if (createFileRef.current) createFileRef.current.value = "";
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        status: createStatus,
        milestoneId: milestoneId !== "none" ? milestoneId : undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        ...(canManageColumns && assigneeId !== "default"
          ? { assigneeId }
          : {}),
      });
      const created = res?.data?.data ?? res?.data;
      const issueId = created?.id as string | undefined;
      let filesResult = { uploaded: 0, failed: 0 };
      if (issueId && createFiles.length) {
        filesResult = await uploadAllAttachments(issueId, createFiles);
      }
      return { created, filesResult };
    },
    onSuccess: ({ filesResult }) => {
      invalidate();
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setEstimatedHours("");
      setCreateFiles([]);
      if (filesResult.uploaded && !filesResult.failed) {
        toast.success(
          `Task created with ${filesResult.uploaded} document${filesResult.uploaded === 1 ? "" : "s"}`,
        );
      } else if (filesResult.uploaded && filesResult.failed) {
        toast.warning(
          `Task created. ${filesResult.uploaded} file(s) uploaded, ${filesResult.failed} failed`,
        );
      } else if (filesResult.failed && !filesResult.uploaded) {
        toast.warning("Task created, but document upload failed");
      } else {
        toast.success("Task created");
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create task");
    },
  });

  const createMilestone = useMutation({
    mutationFn: () =>
      projectsApi.createMilestone(projectId, {
        name: msName.trim(),
        dueDate: msDue || undefined,
        status: "PLANNED",
      }),
    onSuccess: (res) => {
      invalidate();
      const created = res?.data?.data ?? res?.data;
      if (created?.id) {
        setMilestoneFilter(created.id);
        setMilestoneId(created.id);
      }
      setMsOpen(false);
      setMsName("");
      setMsDue("");
      toast.success("Milestone created — add tasks under it");
    },
    onError: () => toast.error("Could not create milestone"),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => issuesApi.delete(taskId),
    onSuccess: () => {
      invalidate();
      toast.success("Moved to trash");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not delete task");
    },
  });

  const handleTaskMove = async (taskId: string, _from: string, toColumn: string) => {
    try {
      await projectsApi.updateTaskStatus(projectId, taskId, toColumn);
      toast.success("Status updated");
      invalidate();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        (status === 401
          ? "Session expired — please sign in again"
          : status === 403
            ? "You can only change status on tasks assigned to you"
            : "Failed to update status");
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      invalidate();
    }
  };

  const handleRenameColumn = async (columnId: string, title: string) => {
    try {
      await projectsApi.renameBoardColumn(projectId, columnId, title);
      toast.success("Column renamed");
      invalidate();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not rename column";
      toast.error(msg);
      throw err;
    }
  };

  const handleAddColumn = async (title: string) => {
    try {
      await projectsApi.addBoardColumn(projectId, title);
      toast.success("Column added");
      invalidate();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not add column";
      toast.error(msg);
      throw err;
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    const col = initialColumns.find((c) => c.id === columnId);
    if (!col) return;
    if (initialColumns.length <= 1) {
      toast.error("Cannot delete the last column");
      return;
    }
    const taskCount = col.tasks.length;
    const ok = await confirm({
      title: `Delete column "${col.title}"?`,
      description:
        taskCount > 0
          ? `${taskCount} task(s) will move to another column. This does not delete the tasks.`
          : "This column will be removed from the board.",
      confirmLabel: "Delete column",
      destructive: true,
    });
    if (!ok) return;

    const moveTo =
      initialColumns.find((c) => c.id !== columnId)?.id || undefined;
    try {
      await projectsApi.deleteBoardColumn(projectId, columnId, moveTo);
      toast.success("Column deleted");
      invalidate();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not delete column";
      toast.error(msg);
    }
  };

  const openCreate = (columnId: string) => {
    setCreateStatus(columnId);
    if (milestoneFilter !== "all" && milestoneFilter !== "none") {
      setMilestoneId(milestoneFilter);
    }
    setCreateOpen(true);
  };

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setEstimatedHours("");
    setAssigneeId("default");
    setCreateFiles([]);
    setPriority("MEDIUM");
    setType("TASK");
    if (createFileRef.current) createFileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            {boardData?.project?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={boardData.project.avatar}
                alt=""
                className="h-10 w-10 rounded-lg border object-cover shrink-0"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold">
                {boardData?.project?.name
                  ? `${boardData.project.name} board`
                  : "Project board"}
              </h1>
              <p className="text-muted-foreground text-sm">
                Tasks, documents, status, and time
                {canManageColumns
                  ? " · Rename, add, or delete columns"
                  : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMsOpen(true)}>
            <Layers className="mr-1 h-4 w-4" /> Milestone
          </Button>
          <Button onClick={() => openCreate(initialColumns[0]?.id || "TODO")}>
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Milestone:</span>
        <Button
          size="sm"
          variant={milestoneFilter === "all" ? "default" : "outline"}
          onClick={() => setMilestoneFilter("all")}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={milestoneFilter === "none" ? "default" : "outline"}
          onClick={() => setMilestoneFilter("none")}
        >
          Unassigned
        </Button>
        {milestones.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant={milestoneFilter === m.id ? "default" : "outline"}
            onClick={() => setMilestoneFilter(m.id)}
          >
            {m.name}
            {m._count?.issues != null && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {m._count.issues}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <KanbanBoard
          initialColumns={initialColumns}
          onTaskMove={handleTaskMove}
          onAddTask={openCreate}
          taskHref={(task) => `/issues/${task.id}`}
          canCreate
          canManageColumns={canManageColumns}
          onRenameColumn={handleRenameColumn}
          onAddColumn={handleAddColumn}
          onDeleteColumn={handleDeleteColumn}
          onTaskDelete={async (task) => {
            const ok = await confirm(trashConfirm("task", task.key || task.title));
            if (ok) deleteTask.mutate(task.id);
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Click a task to open the full task page. Developers can only drag tasks assigned to them.
        {canManageColumns
          ? " Admins can rename, add, or delete columns and assign tasks."
          : ""}
      </p>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={createStatus} onValueChange={setCreateStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {initialColumns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Milestone</Label>
                <Select value={milestoneId} onValueChange={setMilestoneId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No milestone</SelectItem>
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["TASK", "BUG", "STORY", "EPIC"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Est. hours</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="8"
                />
              </div>
            </div>
            {canManageColumns && (
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Project owner (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Project owner (default)
                    </SelectItem>
                    {projectMembers.map(
                      (m: {
                        userId?: string;
                        user?: {
                          id: string;
                          firstName?: string;
                          lastName?: string;
                          email?: string;
                        };
                      }) => {
                        const uid = m.user?.id || m.userId;
                        if (!uid) return null;
                        const name =
                          `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                          m.user?.email ||
                          uid;
                        return (
                          <SelectItem key={uid} value={uid}>
                            {name}
                          </SelectItem>
                        );
                      },
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Unassigned tasks default to the project owner (admin).
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Documents
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => createFileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> Add files
                </Button>
                <input
                  ref={createFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addCreateFiles(e.target.files)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optional. Up to {MAX_ATTACHMENTS} files, 100 MB each. Same for admin,
                employees, and clients.
              </p>
              {createFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No files selected</p>
              ) : (
                <ul className="space-y-1.5">
                  {createFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${file.size}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {file.name}
                        <span className="text-muted-foreground shrink-0">
                          {formatBytes(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted"
                        onClick={() =>
                          setCreateFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending
                ? createFiles.length
                  ? "Creating & uploading…"
                  : "Creating…"
                : createFiles.length
                  ? `Create with ${createFiles.length} file${createFiles.length === 1 ? "" : "s"}`
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={msOpen} onOpenChange={setMsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={msName}
                onChange={(e) => setMsName(e.target.value)}
                placeholder="Phase 1 / Sprint 1 / Discovery"
              />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!msName.trim() || createMilestone.isPending}
              onClick={() => createMilestone.mutate()}
            >
              {createMilestone.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

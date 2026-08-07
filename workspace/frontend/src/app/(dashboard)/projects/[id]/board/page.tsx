"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Milestone = {
  id: string;
  name: string;
  status?: string;
  dueDate?: string | null;
  _count?: { issues?: number };
};

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isClient = isClientUser(user);

  const [milestoneFilter, setMilestoneFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState("TODO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [type, setType] = useState("TASK");
  const [milestoneId, setMilestoneId] = useState<string>("none");
  const [estimatedHours, setEstimatedHours] = useState("");

  const [msOpen, setMsOpen] = useState(false);
  const [msName, setMsName] = useState("");
  const [msDue, setMsDue] = useState("");

  const [timeTask, setTimeTask] = useState<KanbanTask | null>(null);
  const [hours, setHours] = useState("");
  const [timeNote, setTimeNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["project-board", projectId],
    queryFn: () => projectsApi.getBoard(projectId),
    retry: 1,
    enabled: Boolean(accessToken && projectId),
  });

  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ["time-entries", timeTask?.id],
    queryFn: () => issuesApi.listTimeEntries(timeTask!.id),
    enabled: Boolean(timeTask?.id),
  });

  const boardData = data?.data?.data ?? data?.data;
  const milestones: Milestone[] = useMemo(() => {
    const raw = boardData?.milestones;
    return Array.isArray(raw) ? raw : [];
  }, [boardData]);

  const timeEntries = useMemo(() => {
    const raw = timeData?.data?.data ?? timeData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [timeData]);

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

  const createMutation = useMutation({
    mutationFn: () =>
      issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        status: createStatus,
        milestoneId: milestoneId !== "none" ? milestoneId : undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setEstimatedHours("");
      toast.success("Task created");
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

  const logTime = useMutation({
    mutationFn: () =>
      issuesApi.addTimeEntry(timeTask!.id, {
        hours: Number(hours),
        description: timeNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["time-entries", timeTask?.id] });
      setHours("");
      setTimeNote("");
      toast.success("Time logged");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not log time");
    },
  });

  const deleteTime = useMutation({
    mutationFn: (entryId: string) =>
      issuesApi.removeTimeEntry(timeTask!.id, entryId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["time-entries", timeTask?.id] });
      toast.success("Time entry removed");
    },
    onError: () => toast.error("Could not remove entry"),
  });

  const handleTaskMove = async (taskId: string, _from: string, toColumn: string) => {
    try {
      try {
        await issuesApi.transition(taskId, toColumn);
      } catch {
        await projectsApi.updateTaskStatus(projectId, taskId, toColumn);
      }
      toast.success("Status updated");
      invalidate();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 401
          ? "Session expired — please sign in again"
          : "Failed to update status",
      );
      invalidate();
    }
  };

  const openCreate = (columnId: string) => {
    setCreateStatus(columnId);
    if (milestoneFilter !== "all" && milestoneFilter !== "none") {
      setMilestoneId(milestoneFilter);
    }
    setCreateOpen(true);
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
          <div>
            <h1 className="font-display text-2xl font-bold">Project board</h1>
            <p className="text-muted-foreground text-sm">
              {boardData?.project?.name
                ? `${boardData.project.name} — milestones · tasks · status · time`
                : "Milestones, tasks, status, and time"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isClient && (
            <Button variant="outline" onClick={() => setMsOpen(true)}>
              <Layers className="mr-1 h-4 w-4" /> Milestone
            </Button>
          )}
          <Button onClick={() => openCreate("TODO")}>
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {/* Milestone filter */}
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
          onTaskClick={(task) => {
            if (!isClient) setTimeTask(task);
          }}
          canCreate={!isClient}
        />
      )}

      {!isClient && (
        <p className="text-xs text-muted-foreground">
          Tip: click a task to log time. Filter by milestone to focus one delivery slice.
        </p>
      )}

      {/* Create task */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
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
                    {["TODO", "IN_PROGRESS", "TESTING", "DONE"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create milestone */}
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

      {/* Time log on task */}
      <Dialog open={!!timeTask} onOpenChange={(o) => !o && setTimeTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {timeTask?.key || "Task"}
            </DialogTitle>
          </DialogHeader>
          {timeTask && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-sm">{timeTask.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeTask.milestoneName
                    ? `Milestone: ${timeTask.milestoneName}`
                    : "No milestone"}{" "}
                  · Logged {timeTask.loggedHours ?? 0}h
                  {timeTask.estimatedHours != null
                    ? ` / ${timeTask.estimatedHours}h est.`
                    : ""}
                </p>
              </div>
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Log time</CardTitle>
                  <CardDescription className="text-xs">
                    Record hours worked on this task
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0.25}
                      max={24}
                      step={0.25}
                      placeholder="Hours"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="w-28"
                    />
                    <Input
                      placeholder="Note (optional)"
                      value={timeNote}
                      onChange={(e) => setTimeNote(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!hours || Number(hours) <= 0 || logTime.isPending}
                    onClick={() => logTime.mutate()}
                  >
                    {logTime.isPending ? "Saving…" : "Add entry"}
                  </Button>
                </CardContent>
              </Card>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent entries</p>
                {timeLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : timeEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No time logged yet.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {timeEntries.map(
                      (e: {
                        id: string;
                        hours: number;
                        description?: string;
                        date?: string;
                        user?: { firstName?: string; lastName?: string };
                      }) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between text-xs rounded border px-2 py-1.5"
                        >
                          <div>
                            <span className="font-medium">{e.hours}h</span>
                            {e.description ? ` — ${e.description}` : ""}
                            <p className="text-muted-foreground">
                              {[
                                e.user
                                  ? `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim()
                                  : null,
                                e.date ? formatDate(e.date) : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => deleteTime.mutate(e.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

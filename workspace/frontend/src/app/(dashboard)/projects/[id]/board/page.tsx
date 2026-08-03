"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { KanbanBoard, defaultColumns, type KanbanColumn } from "@/components/features/KanbanBoard";
import { issuesApi, projectsApi } from "@/lib/api";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState("TODO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [type, setType] = useState("TASK");

  const { data, isLoading } = useQuery({
    queryKey: ["project-board", projectId],
    queryFn: () => projectsApi.getBoard(projectId),
    retry: false,
  });

  const boardData = data?.data?.data ?? data?.data;
  const initialColumns: KanbanColumn[] = useMemo(() => {
    if (Array.isArray(boardData?.columns) && boardData.columns.length > 0) {
      return boardData.columns;
    }
    return defaultColumns;
  }, [boardData]);

  const createMutation = useMutation({
    mutationFn: () =>
      issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        status: createStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      toast.success("Task created");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create task");
    },
  });

  const handleTaskMove = async (taskId: string, _from: string, toColumn: string) => {
    try {
      await projectsApi.updateTaskStatus(projectId, taskId, toColumn);
      queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
      toast.success("Task moved");
    } catch {
      toast.error("Failed to move task");
      queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    }
  };

  const openCreate = (columnId: string) => {
    setCreateStatus(columnId);
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
            <h1 className="font-display text-2xl font-bold">Kanban Board</h1>
            <p className="text-muted-foreground text-sm">
              {boardData?.project?.name
                ? `${boardData.project.name} — drag tasks between columns`
                : "Drag and drop tasks between columns"}
              {isClient
                ? " · Client view"
                : " · Full workflow (incl. Testing, Code Review, QA)"}
            </p>
          </div>
        </div>
          <Button onClick={() => openCreate("TODO")}>
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <KanbanBoard
          initialColumns={initialColumns}
          onTaskMove={handleTaskMove}
          onAddTask={openCreate}
          canCreate
          taskHref={(task) => `/issues/${task.id}`}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional details"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TASK">Task</SelectItem>
                    <SelectItem value="BUG">Bug</SelectItem>
                    <SelectItem value="STORY">Story</SelectItem>
                    <SelectItem value="IMPROVEMENT">Improvement</SelectItem>
                    <SelectItem value="FEATURE_REQUEST">Feature request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWEST">Lowest</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="HIGHEST">Highest</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status column</Label>
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
    </div>
  );
}

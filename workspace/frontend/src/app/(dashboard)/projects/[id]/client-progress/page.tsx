"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientsApi, projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

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
      {mutation.isPending ? "Creating..." : "Create client login"}
    </Button>
  );
}

type MilestoneStatus = "PLANNED" | "IN_PROGRESS" | "DONE";
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ClientProgressPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [milestoneForm, setMilestoneForm] = useState({ name: "", dueDate: "" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    estimatedHours: "",
    milestoneId: "none",
  });

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

  const milestones = project?.milestones ?? [];
  const tasks = project?.clientTasks ?? [];
  const progress = project?.progressPercent ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project", id] });

  const updateProject = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Saved");
    },
    onError: () => toast.error("Could not save"),
  });

  const enablePortal = useMutation({
    mutationFn: () => projectsApi.enablePortal(id),
    onSuccess: () => {
      invalidate();
      toast.success("Client link ready");
    },
    onError: () => toast.error("Could not enable link"),
  });

  const rotatePortal = useMutation({
    mutationFn: () => projectsApi.rotatePortal(id),
    onSuccess: () => {
      invalidate();
      toast.success("New link created — old link no longer works");
    },
    onError: () => toast.error("Could not refresh link"),
  });

  const createMilestone = useMutation({
    mutationFn: () =>
      projectsApi.createMilestone(id, {
        name: milestoneForm.name,
        dueDate: milestoneForm.dueDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setMilestoneForm({ name: "", dueDate: "" });
      toast.success("Milestone added");
    },
    onError: () => toast.error("Could not add milestone"),
  });

  const updateMilestone = useMutation({
    mutationFn: ({ milestoneId, status }: { milestoneId: string; status: MilestoneStatus }) =>
      projectsApi.updateMilestone(id, milestoneId, { status }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Could not update milestone"),
  });

  const deleteMilestone = useMutation({
    mutationFn: (milestoneId: string) => projectsApi.deleteMilestone(id, milestoneId),
    onSuccess: () => {
      invalidate();
      toast.success("Milestone removed");
    },
    onError: () => toast.error("Could not remove milestone"),
  });

  const createTask = useMutation({
    mutationFn: () =>
      projectsApi.createClientTask(id, {
        title: taskForm.title,
        estimatedHours: taskForm.estimatedHours
          ? Number(taskForm.estimatedHours)
          : undefined,
        milestoneId:
          taskForm.milestoneId !== "none" ? taskForm.milestoneId : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setTaskForm({ title: "", estimatedHours: "", milestoneId: "none" });
      toast.success("Client task added");
    },
    onError: () => toast.error("Could not add task"),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      projectsApi.updateClientTask(id, taskId, { status }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Could not update task"),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => projectsApi.deleteClientTask(id, taskId),
    onSuccess: () => {
      invalidate();
      toast.success("Task removed");
    },
    onError: () => toast.error("Could not remove task"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project doesn't exist or you don't have access."
        actionLabel="Back to projects"
        actionHref="/projects"
      />
    );
  }

  const portalUrl =
    project.portalEnabled && project.portalToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${project.portalToken}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href={`/projects/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to project
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-bold">Client Progress</h1>
          <p className="text-muted-foreground text-sm">
            Set timeline, milestones, and client tasks — then share the client link
          </p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overall progress</CardTitle>
          <CardDescription>
            Based on client tasks marked Done ({project.taskCounts?.done ?? 0} of{" "}
            {project.taskCounts?.total ?? 0})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-display font-bold text-primary mb-2">{progress}%</p>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Client + Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client & timeline</CardTitle>
            <CardDescription>Who this project is for, and when it should finish</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={project.clientId || "none"}
                onValueChange={(v) =>
                  updateProject.mutate({ clientId: v === "none" ? null : v })
                }
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
              {project.clientId && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <CreateClientLoginButton
                    clientId={project.clientId}
                    onDone={invalidate}
                  />
                  <p className="text-xs text-muted-foreground">
                    Creates email/mobile login for this client (needs email or phone on the client)
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  defaultValue={toDateInput(project.startDate)}
                  key={`start-${project.startDate ?? "x"}`}
                  onBlur={(e) => {
                    const next = e.target.value || null;
                    const prev = toDateInput(project.startDate) || null;
                    if (next !== prev) {
                      updateProject.mutate({ startDate: next });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  defaultValue={toDateInput(project.endDate)}
                  key={`end-${project.endDate ?? "x"}`}
                  onBlur={(e) => {
                    const next = e.target.value || null;
                    const prev = toDateInput(project.endDate) || null;
                    if (next !== prev) {
                      updateProject.mutate({ endDate: next });
                    }
                  }}
                />
              </div>
            </div>
            {(project.startDate || project.endDate) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {project.startDate ? formatDate(project.startDate) : "—"} →{" "}
                {project.endDate ? formatDate(project.endDate) : "—"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Share link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client link</CardTitle>
            <CardDescription>
              Copy and send this link to the client (WhatsApp / email). No login needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!project.portalEnabled || !project.portalToken ? (
              <Button
                onClick={() => enablePortal.mutate()}
                disabled={enablePortal.isPending}
              >
                <Link2 className="h-4 w-4 mr-1" />
                {enablePortal.isPending ? "Creating..." : "Enable client link"}
              </Button>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs break-all font-mono">
                  {portalUrl}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(portalUrl);
                      toast.success("Client link copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy client link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rotatePortal.mutate()}
                    disabled={rotatePortal.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> New link
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={portalUrl} target="_blank" rel="noreferrer">
                      Preview
                    </a>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
          <CardDescription>Set these before / during the project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Milestone name (e.g. Design approval)"
              value={milestoneForm.name}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, name: e.target.value }))}
              className="flex-1"
            />
            <Input
              type="date"
              value={milestoneForm.dueDate}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="sm:w-44"
            />
            <Button
              disabled={!milestoneForm.name.trim() || createMilestone.isPending}
              onClick={() => createMilestone.mutate()}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {milestones.map(
                (m: {
                  id: string;
                  name: string;
                  dueDate?: string | null;
                  status: MilestoneStatus;
                }) => (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}
                      </p>
                    </div>
                    <Select
                      value={m.status}
                      onValueChange={(v) =>
                        updateMilestone.mutate({
                          milestoneId: m.id,
                          status: v as MilestoneStatus,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLANNED">Planned</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => deleteMilestone.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client tasks</CardTitle>
          <CardDescription>
            What the client sees — not your internal board tasks. Add hours if useful.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_160px_auto]">
            <Input
              placeholder="Task title (e.g. Homepage design)"
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              type="number"
              min={0}
              placeholder="Hours"
              value={taskForm.estimatedHours}
              onChange={(e) =>
                setTaskForm((f) => ({ ...f, estimatedHours: e.target.value }))
              }
            />
            <Select
              value={taskForm.milestoneId}
              onValueChange={(v) => setTaskForm((f) => ({ ...f, milestoneId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Milestone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No milestone</SelectItem>
                {milestones.map((m: { id: string; name: string }) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!taskForm.title.trim() || createTask.isPending}
              onClick={() => createTask.mutate()}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client tasks yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {tasks.map(
                (t: {
                  id: string;
                  title: string;
                  status: TaskStatus;
                  estimatedHours?: string | number | null;
                  milestone?: { name: string } | null;
                }) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate flex items-center gap-2">
                        {t.status === "DONE" && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.milestone?.name ? `${t.milestone.name} · ` : ""}
                        {t.estimatedHours != null
                          ? `${Number(t.estimatedHours)} hrs`
                          : "No hours set"}
                      </p>
                    </div>
                    <Select
                      value={t.status}
                      onValueChange={(v) =>
                        updateTask.mutate({ taskId: t.id, status: v as TaskStatus })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">To do</SelectItem>
                        <SelectItem value="IN_PROGRESS">Doing</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => deleteTask.mutate(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

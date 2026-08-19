"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  ExternalLink,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Send,
  StickyNote,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CrmDetailLayout } from "@/components/crm/CrmDetailLayout";
import { CrmActivityFeed, type CrmActivityItem } from "@/components/crm/CrmActivityFeed";
import { clientsApi, documentsApi, projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

const invoiceStatusVariant: Record<
  string,
  "secondary" | "info" | "success" | "destructive" | "warning"
> = {
  DRAFT: "secondary",
  SENT: "info",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "warning",
};

type ClientActivity = CrmActivityItem & {
  metadata?: { title?: string; dueDate?: string };
};

function activityTitle(a: ClientActivity) {
  return a.metadata?.title;
}

export default function ClientDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [activityType, setActivityType] = useState("NOTE");
  const [activityBody, setActivityBody] = useState("");
  const [comment, setComment] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [callTo, setCallTo] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDue, setEventDue] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    country: "",
    status: "active",
    companyName: "",
    firstName: "",
    lastName: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["clients", id],
    queryFn: () => clientsApi.get(id),
    enabled: !!id,
    retry: false,
  });
  const client = data?.data?.data ?? data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clients", id] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const addActivity = (
    payload: { type: string; body: string; title?: string; dueDate?: string },
    onDone?: () => void,
  ) => clientsApi.addActivity(id, payload).then(() => {
    invalidate();
    onDone?.();
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => clientsApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Client updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Could not update client"),
  });

  const activityMutation = useMutation({
    mutationFn: () => addActivity({ type: activityType, body: activityBody }, () => setActivityBody("")),
    onSuccess: () => toast.success("Activity logged"),
    onError: () => toast.error("Could not log activity"),
  });

  const commentMutation = useMutation({
    mutationFn: () => addActivity({ type: "COMMENT", body: comment }, () => setComment("")),
    onSuccess: () => toast.success("Comment added"),
    onError: () => toast.error("Could not add comment"),
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      addActivity(
        { type: "NOTE", title: noteTitle || undefined, body: noteBody },
        () => {
          setNoteTitle("");
          setNoteBody("");
        },
      ),
    onSuccess: () => toast.success("Note saved"),
    onError: () => toast.error("Could not save note"),
  });

  const callMutation = useMutation({
    mutationFn: () =>
      addActivity(
        {
          type: "CALL",
          body: [callTo ? `To: ${callTo}` : null, callNotes].filter(Boolean).join("\n"),
        },
        () => setCallNotes(""),
      ),
    onSuccess: () => toast.success("Call logged"),
    onError: () => toast.error("Could not log call"),
  });

  const eventMutation = useMutation({
    mutationFn: () =>
      addActivity(
        {
          type: "MEETING",
          title: eventTitle || undefined,
          body: eventNotes || eventTitle,
          dueDate: eventDue || undefined,
        },
        () => {
          setEventTitle("");
          setEventDue("");
          setEventNotes("");
        },
      ),
    onSuccess: () => toast.success("Event added"),
    onError: () => toast.error("Could not add event"),
  });

  const taskLogMutation = useMutation({
    mutationFn: () =>
      addActivity(
        {
          type: "TASK",
          title: taskTitle,
          body: taskTitle,
          dueDate: taskDue || undefined,
        },
        () => {
          setTaskTitle("");
          setTaskDue("");
        },
      ),
    onSuccess: () => toast.success("Task logged"),
    onError: () => toast.error("Could not add task"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.remove(id),
    onSuccess: () => {
      toast.success("Client moved to trash");
      router.push("/clients");
    },
    onError: () => toast.error("Could not delete client"),
  });

  const projectMutation = useMutation({
    mutationFn: () =>
      projectsApi.create({
        name: projectName,
        clientId: id,
        key: projectName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6) || "PRJ",
      }),
    onSuccess: (res) => {
      invalidate();
      toast.success("Project created");
      setProjectOpen(false);
      setProjectName("");
      const projectId = res?.data?.id ?? res?.data?.data?.id;
      if (projectId) router.push(`/projects/${projectId}`);
    },
    onError: () => toast.error("Could not create project"),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file, { clientId: id, name: file.name }),
    onSuccess: () => {
      invalidate();
      toast.success("Document uploaded");
    },
    onError: () => toast.error("Upload failed"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.remove(docId),
    onSuccess: () => {
      invalidate();
      toast.success("Document removed");
    },
    onError: () => toast.error("Could not remove document"),
  });

  const crmActivities: ClientActivity[] = client?.crmActivities ?? [];

  const comments = useMemo(
    () => crmActivities.filter((a) => a.type === "COMMENT"),
    [crmActivities],
  );

  const notes = useMemo(
    () => crmActivities.filter((a) => a.type === "NOTE"),
    [crmActivities],
  );

  const calls = useMemo(
    () => crmActivities.filter((a) => a.type === "CALL"),
    [crmActivities],
  );

  const loggedTasks = useMemo(
    () => crmActivities.filter((a) => a.type === "TASK"),
    [crmActivities],
  );

  const milestones = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      dueDate?: string;
      status: string;
      projectName: string;
      projectId: string;
    }> = [];
    for (const p of client?.projects ?? []) {
      for (const m of p.milestones ?? []) {
        items.push({
          id: m.id,
          name: m.name,
          dueDate: m.dueDate,
          status: m.status,
          projectName: p.name,
          projectId: p.id,
        });
      }
    }
    return items.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [client]);

  const clientTasks = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      status: string;
      projectName: string;
      projectId: string;
      milestoneName?: string;
    }> = [];
    for (const p of client?.projects ?? []) {
      for (const t of p.clientTasks ?? []) {
        items.push({
          id: t.id,
          title: t.title,
          status: t.status,
          projectName: p.name,
          projectId: p.id,
          milestoneName: t.milestone?.name,
        });
      }
    }
    return items;
  }, [client]);

  const openClientTasks = useMemo(
    () => clientTasks.filter((t) => t.status !== "DONE"),
    [clientTasks],
  );

  const events = useMemo(() => {
    const meetingEvents = crmActivities
      .filter((a) => a.type === "MEETING" || a.metadata?.dueDate)
      .map((a) => ({
        id: a.id,
        title: activityTitle(a) || a.body,
        dueDate: a.metadata?.dueDate || a.createdAt,
        source: "activity" as const,
      }));
    const milestoneEvents = milestones.map((m) => ({
      id: m.id,
      title: m.name,
      dueDate: m.dueDate || m.id,
      source: "milestone" as const,
      projectName: m.projectName,
      status: m.status,
    }));
    return [...meetingEvents, ...milestoneEvents].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }, [crmActivities, milestones]);

  const activityItems: CrmActivityItem[] = useMemo(() => {
    if (!client) return [];
    const items: CrmActivityItem[] = [...crmActivities];
    for (const inv of client.invoices ?? []) {
      if (inv.paidAt) {
        items.push({
          id: `inv-paid-${inv.id}`,
          type: "PAYMENT",
          body: `Invoice ${inv.number} marked paid — ${inv.currency} ${Number(inv.amount).toLocaleString()}`,
          createdAt: inv.paidAt,
        });
      }
      if (inv.sentAt) {
        items.push({
          id: `inv-sent-${inv.id}`,
          type: "INVOICE",
          body: `Invoice ${inv.number} sent to client`,
          createdAt: inv.sentAt,
        });
      }
      items.push({
        id: `inv-created-${inv.id}`,
        type: "INVOICE",
        body: `Invoice ${inv.number} created — ${inv.currency} ${Number(inv.amount).toLocaleString()} (${inv.status})`,
        createdAt: inv.createdAt,
      });
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [client, crmActivities]);

  const openEdit = () => {
    if (!client) return;
    setEditForm({
      name: client.name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      website: client.website ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      country: client.country ?? "",
      status: client.status ?? "active",
      companyName: client.companyName ?? "",
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
    });
    setEditOpen(true);
  };

  if (isLoading || !client) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  const isPerson = client.type === "INDIVIDUAL";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/clients">
          <ArrowLeft className="h-4 w-4 mr-1" /> Clients
        </Link>
      </Button>

      <CrmDetailLayout
        header={
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h1 className="font-display text-xl font-bold truncate">{client.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant={client.status === "active" ? "success" : "warning"}>
                  {client.status}
                </Badge>
                <Badge variant="secondary">{isPerson ? "Individual" : "Company"}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await confirm(trashConfirm("client", client.name));
                  if (ok) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
        sidePanel={
          <>
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-2">Details</p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {isPerson ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{client.name}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone}
                  </div>
                )}
                {(client.address || client.city || client.country) && (
                  <p className="text-muted-foreground pl-6 whitespace-pre-wrap">
                    {[client.address, client.city, client.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
              <div className="rounded-lg border px-2.5 py-2">
                <p className="text-xs text-muted-foreground">Projects</p>
                <p className="font-semibold">{client._count?.projects ?? client.projects?.length ?? 0}</p>
              </div>
              <div className="rounded-lg border px-2.5 py-2">
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="font-semibold">{client._count?.invoices ?? client.invoices?.length ?? 0}</p>
              </div>
              <div className="rounded-lg border px-2.5 py-2">
                <p className="text-xs text-muted-foreground">Tasks</p>
                <p className="font-semibold">{openClientTasks.length}</p>
              </div>
              <div className="rounded-lg border px-2.5 py-2">
                <p className="text-xs text-muted-foreground">Milestones</p>
                <p className="font-semibold">{milestones.length}</p>
              </div>
            </div>

            {client.convertedFromLead && (
              <div className="pt-2 border-t">
                <p className="text-xs uppercase text-muted-foreground mb-1">Converted from</p>
                <Link href={`/leads/${client.convertedFromLead.id}`} className="text-sm text-primary hover:underline">
                  {client.convertedFromLead.title}
                </Link>
              </div>
            )}
          </>
        }
        tabs={[
          {
            id: "activity",
            label: "Activity",
            icon: <FileText className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 space-y-2">
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTE">Note</SelectItem>
                      <SelectItem value="COMMENT">Comment</SelectItem>
                      <SelectItem value="TASK">Task</SelectItem>
                      <SelectItem value="CALL">Call</SelectItem>
                      <SelectItem value="MEETING">Event</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Log activity…"
                      value={activityBody}
                      onChange={(e) => setActivityBody(e.target.value)}
                      className="min-h-[72px]"
                    />
                    <Button
                      size="icon"
                      className="shrink-0"
                      disabled={!activityBody.trim() || activityMutation.isPending}
                      onClick={() => activityMutation.mutate()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CrmActivityFeed items={activityItems} />
              </div>
            ),
          },
          {
            id: "comments",
            label: "Comments",
            icon: <MessageCircle className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    size="icon"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <CrmActivityFeed items={comments} />
              </div>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            icon: <StickyNote className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="Title (optional)"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Note"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!noteBody.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate()}
                  >
                    Save note
                  </Button>
                </div>
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg border px-3 py-2 text-sm">
                      {activityTitle(n) && <p className="font-medium mb-1">{activityTitle(n)}</p>}
                      <p className="whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "events",
            label: "Events",
            icon: <Calendar className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="Event title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={eventDue}
                    onChange={(e) => setEventDue(e.target.value)}
                  />
                  <Textarea
                    placeholder="Notes (optional)"
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!eventTitle.trim() || eventMutation.isPending}
                    onClick={() => eventMutation.mutate()}
                  >
                    Add event
                  </Button>
                </div>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((e) => (
                      <div key={e.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between gap-2">
                        <div>
                          <p className="font-medium">{e.title}</p>
                          {"projectName" in e && e.projectName && (
                            <p className="text-xs text-muted-foreground">{e.projectName}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(e.dueDate).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "tasks",
            label: "Tasks",
            icon: <CheckSquare className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="flex-1 min-w-[180px]"
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                  />
                  <Button
                    disabled={!taskTitle.trim() || taskLogMutation.isPending}
                    onClick={() => taskLogMutation.mutate()}
                  >
                    Log task
                  </Button>
                </div>

                {openClientTasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Current project tasks</p>
                    {openClientTasks.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.projectId}`}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <div>
                          <span>{t.title}</span>
                          <p className="text-xs text-muted-foreground">
                            {t.projectName}
                            {t.milestoneName ? ` · ${t.milestoneName}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      </Link>
                    ))}
                  </div>
                )}

                {loggedTasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Logged tasks</p>
                    {loggedTasks.map((t) => (
                      <div key={t.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between gap-2">
                        <span>{activityTitle(t) || t.body}</span>
                        {t.metadata?.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.metadata.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {openClientTasks.length === 0 && loggedTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No open tasks.</p>
                )}
              </div>
            ),
          },
          {
            id: "milestones",
            label: "Milestones",
            icon: <Calendar className="h-3.5 w-3.5" />,
            content:
              milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones on client projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <Link
                      key={m.id}
                      href={`/projects/${m.projectId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40"
                    >
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.projectName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px] mb-1">{m.status}</Badge>
                        {m.dueDate && (
                          <p className="text-xs text-muted-foreground">{formatDate(m.dueDate)}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ),
          },
          {
            id: "projects",
            label: "Projects",
            icon: <FolderKanban className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm text-muted-foreground">Projects for this client</p>
                  <Button size="sm" onClick={() => setProjectOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New project
                  </Button>
                </div>
                {(client.projects ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(client.projects ?? []).map(
                      (p: {
                        id: string;
                        name: string;
                        key: string;
                        status: string;
                        _count?: { issues?: number; milestones?: number };
                      }) => (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.key} · {p._count?.issues ?? 0} issues ·{" "}
                              {p._count?.milestones ?? 0} milestones
                            </p>
                          </div>
                          <Badge variant="outline">{p.status}</Badge>
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "calls",
            label: "Calls",
            icon: <Phone className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="Phone number"
                    value={callTo || client.phone || ""}
                    onChange={(e) => setCallTo(e.target.value)}
                  />
                  <Textarea
                    placeholder="Call notes"
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={callMutation.isPending}
                    onClick={() => callMutation.mutate()}
                  >
                    Log call
                  </Button>
                </div>
                <CrmActivityFeed items={calls} />
              </div>
            ),
          },
          {
            id: "invoices",
            label: "Invoices",
            icon: <Receipt className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                {(client.invoices ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Number</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(client.invoices ?? []).map(
                          (inv: {
                            id: string;
                            number: string;
                            title: string;
                            amount: number | string;
                            currency: string;
                            status: string;
                            dueDate?: string;
                          }) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.number}</TableCell>
                              <TableCell>{inv.title}</TableCell>
                              <TableCell>
                                {inv.currency} {Number(inv.amount).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={invoiceStatusVariant[inv.status] ?? "secondary"}>
                                  {inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            icon: <Paperclip className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Pre-work documents</p>
                    <p className="text-xs text-muted-foreground">
                      Contracts, briefs, and files needed before starting work
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={uploadMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadMutation.isPending ? "Uploading…" : "Upload"}
                  </Button>
                </div>
                {(client.documents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(client.documents ?? []).map(
                      (doc: {
                        id: string;
                        name: string;
                        createdAt: string;
                        uploadedBy?: { firstName?: string; lastName?: string };
                      }) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  const res = await documentsApi.download(doc.id);
                                  const payload = res.data?.data ?? res.data;
                                  if (payload?.url) {
                                    window.open(payload.url, "_blank", "noopener,noreferrer");
                                  }
                                } catch {
                                  toast.error("Could not download document");
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Delete document?",
                                  description: `Remove "${doc.name}"?`,
                                  confirmLabel: "Delete",
                                  destructive: true,
                                });
                                if (ok) deleteDocMutation.mutate(doc.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={editForm.website}
                onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={editForm.country}
                  onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(editForm)}
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project for {client.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Project name</Label>
            <Input
              placeholder="Website redesign"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!projectName.trim() || projectMutation.isPending}
              onClick={() => projectMutation.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

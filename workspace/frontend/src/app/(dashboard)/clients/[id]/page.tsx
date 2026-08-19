"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Send,
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
import { Switch } from "@/components/ui/switch";
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
import {
  clientsApi,
  documentsApi,
  onboardingApi,
  projectsApi,
} from "@/lib/api";
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

const ACTIVITY_TYPES = [
  { key: "NOTE", label: "Note" },
  { key: "COMMENT", label: "Comment" },
  { key: "TASK", label: "Task" },
  { key: "CALL", label: "Call" },
  { key: "MEETING", label: "Meeting" },
  { key: "EMAIL", label: "Email" },
];

function publicFormUrl(token: string, clientId: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/onboarding/public/${token}?clientId=${clientId}`;
}

function setupInviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/setup/${token}`;
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
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"assign" | "create">("assign");
  const [assignFormId, setAssignFormId] = useState("");
  const [createFormTitle, setCreateFormTitle] = useState("");
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

  const { data: formsData } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: () => onboardingApi.listForms(),
    retry: false,
  });

  const catalogForms = useMemo(() => {
    const raw = formsData?.data?.data ?? formsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [formsData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clients", id] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

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
    mutationFn: () => clientsApi.addActivity(id, { type: activityType, body: activityBody }),
    onSuccess: () => {
      setActivityBody("");
      invalidate();
      toast.success("Activity logged");
    },
    onError: () => toast.error("Could not log activity"),
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

  const assignMutation = useMutation<any, Error, void>({
    mutationFn: () => {
      if (assignMode === "assign") {
        return clientsApi.assignOnboardingForm(id, { formId: assignFormId });
      }
      return clientsApi.createOnboardingForm(id, {
        title: createFormTitle || `${client?.name} onboarding`,
        publish: true,
      });
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(assignMode === "assign" ? "Form assigned" : "Form created");
      setAssignOpen(false);
      setAssignFormId("");
      setCreateFormTitle("");
      const formId =
        assignMode === "create"
          ? (res?.data?.form?.id as string | undefined)
          : undefined;
      if (formId) router.push(`/onboarding/${formId}/builder`);
    },
    onError: () => toast.error("Could not save form"),
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

  const activityItems: CrmActivityItem[] = useMemo(() => {
    if (!client) return [];
    const items: CrmActivityItem[] = [...(client.crmActivities ?? [])];
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
  }, [client]);

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

  const copySetupLink = async () => {
    if (!client) return;
    try {
      let token = client.setupEnabled ? client.setupToken : null;
      if (!token) {
        const res = await clientsApi.enableSetup(id);
        const payload = res.data?.data ?? res.data;
        token = payload?.setupToken as string;
        invalidate();
      }
      if (!token) throw new Error("No setup token");
      await navigator.clipboard.writeText(setupInviteUrl(token));
      toast.success("Setup link copied");
    } catch {
      toast.error("Could not copy setup link");
    }
  };

  const toggleRequireNda = async (requireNda: boolean) => {
    try {
      if (!client?.setupEnabled) {
        await clientsApi.enableSetup(id);
      }
      await clientsApi.updateSetup(id, { requireNda });
      invalidate();
      toast.success(requireNda ? "NDA required" : "NDA not required");
    } catch {
      toast.error("Could not update setup");
    }
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
  const progress = client.setupProgress;

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
                {progress?.setupComplete && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Setup complete
                  </Badge>
                )}
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
                {client.website && (
                  <a
                    href={
                      client.website.startsWith("http")
                        ? client.website
                        : `https://${client.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline block pl-6 truncate"
                  >
                    {client.website}
                  </a>
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
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="font-semibold">{client._count?.documents ?? client.documents?.length ?? 0}</p>
              </div>
              <div className="rounded-lg border px-2.5 py-2">
                <p className="text-xs text-muted-foreground">Deals</p>
                <p className="font-semibold">{client._count?.deals ?? 0}</p>
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

            {client.user && (
              <div className="pt-2 border-t">
                <p className="text-xs uppercase text-muted-foreground mb-1">Portal login</p>
                <p className="text-sm">{client.user.email}</p>
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
                  <div className="flex flex-wrap gap-2">
                    <Select value={activityType} onValueChange={setActivityType}>
                      <SelectTrigger className="w-36 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Log a note, task, payment follow-up, or update…"
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
            id: "projects",
            label: "Projects",
            icon: <FolderKanban className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Projects linked to this client
                  </p>
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
            id: "invoices",
            label: "Invoices",
            icon: <Receipt className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm text-muted-foreground">All invoices for this client</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/invoices?clientId=${id}`}>View in Invoices</Link>
                  </Button>
                </div>
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
                      Contracts, briefs, IDs, and other files needed before starting work
                    </p>
                  </div>
                  <div>
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
                </div>
                {(client.documents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(client.documents ?? []).map(
                      (doc: {
                        id: string;
                        name: string;
                        mimeType?: string;
                        size?: number;
                        createdAt: string;
                        uploadedBy?: { firstName?: string; lastName?: string };
                      }) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(doc.createdAt)}
                              {doc.uploadedBy
                                ? ` · ${[doc.uploadedBy.firstName, doc.uploadedBy.lastName].filter(Boolean).join(" ")}`
                                : ""}
                            </p>
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
                                  } else {
                                    toast.message("Download ready", {
                                      description: doc.name,
                                    });
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
                                  description: `Remove "${doc.name}"? This cannot be undone.`,
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
          {
            id: "setup",
            label: "Setup",
            icon: <ClipboardList className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={copySetupLink}>
                    <Link2 className="h-4 w-4 mr-1" /> Copy setup link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                    <ClipboardList className="h-4 w-4 mr-1" /> Assign form
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                  <Label htmlFor="require-nda" className="text-sm font-normal">
                    Require NDA before work
                  </Label>
                  <Switch
                    id="require-nda"
                    checked={!!client.requireNda}
                    onCheckedChange={toggleRequireNda}
                  />
                </div>

                {progress && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={progress.accountDone ? "success" : "secondary"}>
                      Account {progress.accountDone ? "✓" : "pending"}
                    </Badge>
                    <Badge variant={progress.formsComplete ? "success" : "secondary"}>
                      Forms {progress.formsDone}/{progress.formsTotal}
                    </Badge>
                    {progress.requireNda && (
                      <Badge variant={progress.ndaDone ? "success" : "secondary"}>
                        NDA {progress.ndaDone ? "✓" : "pending"}
                      </Badge>
                    )}
                  </div>
                )}

                {(client.formAssignments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No onboarding forms assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {(client.formAssignments ?? []).map(
                      (a: {
                        id: string;
                        status: string;
                        form: {
                          id: string;
                          title: string;
                          status: string;
                          secureToken: string;
                        };
                      }) => {
                        const link = publicFormUrl(a.form.secureToken, id);
                        return (
                          <div key={a.id} className="rounded-lg border p-3 space-y-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{a.form.title}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    {a.form.status}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {a.status}
                                  </Badge>
                                </div>
                              </div>
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={`/onboarding/${a.form.id}/builder`}>Edit</Link>
                              </Button>
                            </div>
                            {a.form.status === "PUBLISHED" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    toast.success("Client link copied");
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                                  <a href={link} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      },
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

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onboarding form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select
              value={assignMode}
              onValueChange={(v) => setAssignMode(v as "assign" | "create")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assign">Assign existing form</SelectItem>
                <SelectItem value="create">Create form for client</SelectItem>
              </SelectContent>
            </Select>
            {assignMode === "assign" ? (
              <Select
                value={assignFormId || "none"}
                onValueChange={(v) => setAssignFormId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select form</SelectItem>
                  {catalogForms.map((f: { id: string; title: string; status: string }) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title} ({f.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Form title"
                value={createFormTitle}
                onChange={(e) => setCreateFormTitle(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                assignMutation.isPending ||
                (assignMode === "assign" ? !assignFormId : !createFormTitle.trim())
              }
              onClick={() => assignMutation.mutate()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

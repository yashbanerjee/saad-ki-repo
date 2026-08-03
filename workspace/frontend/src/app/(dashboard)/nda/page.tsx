"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  FileSignature,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { clientsApi, ndaApi } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { NdaDocumentPreview } from "@/components/features/NdaDocumentPreview";

const DEFAULT_NDA = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{date}}

BETWEEN

{{companyName}} ("Disclosing Party")

AND

{{clientName}} ("Receiving Party")

1. Purpose
The parties wish to explore a business relationship and may share confidential information.

2. Confidential Information
"Confidential Information" means any non-public information disclosed by either party, including business plans, client data, technical materials, and commercial terms.

3. Obligations
The Receiving Party agrees to:
(a) keep Confidential Information strictly confidential;
(b) use it only for the stated purpose;
(c) not disclose it to third parties without prior written consent.

4. Term
This Agreement remains in effect for three (3) years from the date of signature, unless terminated earlier in writing.

5. Governing Law
This Agreement shall be governed by the applicable laws of the Disclosing Party's jurisdiction.

IN WITNESS WHEREOF, the parties have executed this Agreement as of {{date}}.

────────────────────────────────
Company: {{companyName}}

────────────────────────────────
Client signature: {{clientName}}
Date: {{date}}
`;

interface NdaTemplate {
  id: string;
  name?: string;
  title?: string;
  version: string;
  signed?: number;
  assignedClients?: number;
  status: string;
  isActive?: boolean;
  content?: string;
  clients?: { id: string; name: string }[];
}

interface ClientOption {
  id: string;
  name: string;
}

function localPreview(content: string, companyName: string, clientName: string) {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return content
    .replaceAll("{{companyName}}", companyName || "Your Company")
    .replaceAll("{{clientName}}", clientName || "Client Name")
    .replaceAll("{{date}}", date);
}

export default function NDAPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<NdaTemplate | null>(null);
  const [previewText, setPreviewText] = useState("");

  const [form, setForm] = useState({
    title: "Standard NDA",
    content: DEFAULT_NDA,
    mode: "general" as "general" | "client",
    clientId: "",
  });

  const [assignForm, setAssignForm] = useState({
    clientId: "",
    mode: "existing" as "existing" | "custom",
    templateId: "",
    customTitle: "",
    customContent: DEFAULT_NDA,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["nda-templates"],
    queryFn: () => ndaApi.listTemplates(),
    retry: false,
  });

  const { data: signedData, isLoading: signedLoading } = useQuery({
    queryKey: ["nda-signed"],
    queryFn: () => ndaApi.listSigned(),
    retry: false,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "nda"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    retry: false,
  });

  const templates: NdaTemplate[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const signedDocs = useMemo(() => {
    const raw = signedData?.data?.data ?? signedData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [signedData]);

  const clients: ClientOption[] = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw.map((c: ClientOption) => ({ id: c.id, name: c.name })) : [];
  }, [clientsData]);

  const createMutation = useMutation({
    mutationFn: () =>
      ndaApi.createTemplate({
        title: form.title.trim(),
        content: form.content,
        ...(form.mode === "client" && form.clientId ? { clientId: form.clientId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nda-templates"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        form.mode === "client"
          ? "Custom NDA created and assigned to client"
          : "NDA template created",
      );
      setCreateOpen(false);
      setForm({ title: "Standard NDA", content: DEFAULT_NDA, mode: "general", clientId: "" });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not create template";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      ndaApi.updateTemplate(selected!.id, {
        title: form.title.trim(),
        content: form.content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nda-templates"] });
      toast.success("Template updated");
      setEditOpen(false);
      setSelected(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not update template";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      ndaApi.assign({
        clientId: assignForm.clientId,
        ...(assignForm.mode === "existing"
          ? { templateId: assignForm.templateId }
          : {
              customTitle: assignForm.customTitle || undefined,
              customContent: assignForm.customContent,
            }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nda-templates"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("NDA assigned to client");
      setAssignOpen(false);
      setAssignForm({
        clientId: "",
        mode: "existing",
        templateId: "",
        customTitle: "",
        customContent: DEFAULT_NDA,
      });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not assign NDA";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const openCreate = () => {
    setForm({ title: "Standard NDA", content: DEFAULT_NDA, mode: "general", clientId: "" });
    setCreateOpen(true);
  };

  const openEdit = (tpl: NdaTemplate) => {
    setSelected(tpl);
    setForm({
      title: tpl.title || tpl.name || "NDA",
      content: tpl.content || DEFAULT_NDA,
      mode: "general",
      clientId: "",
    });
    setEditOpen(true);
  };

  const openPreview = async (tpl: NdaTemplate) => {
    setSelected(tpl);
    try {
      const res = await ndaApi.preview(tpl.id, {
        clientId: tpl.clients?.[0]?.id,
      });
      const payload = res.data?.data ?? res.data;
      setPreviewText(payload?.content || tpl.content || "");
    } catch {
      setPreviewText(
        localPreview(tpl.content || DEFAULT_NDA, "Your Company", tpl.clients?.[0]?.name || "Client"),
      );
    }
    setPreviewOpen(true);
  };

  const openAssign = (tpl?: NdaTemplate) => {
    setAssignForm({
      clientId: "",
      mode: tpl ? "existing" : "existing",
      templateId: tpl?.id || templates[0]?.id || "",
      customTitle: "",
      customContent: DEFAULT_NDA,
    });
    setAssignOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">NDA Management</h1>
          <p className="text-muted-foreground">
            Create templates, customize per client, and assign for signing
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => openAssign()}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign to client
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="signed">Signed Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No NDA templates"
              description="Create a template to start collecting signed agreements."
              actionLabel="New Template"
              onAction={openCreate}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="glass-subtle">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileSignature className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {template.title || template.name}
                        </CardTitle>
                        <CardDescription>v{template.version}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={template.isActive === false ? "secondary" : "success"}>
                        {template.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {template.signed ?? 0} signed
                        {(template.assignedClients ?? 0) > 0
                          ? ` · ${template.assignedClients} clients`
                          : ""}
                      </span>
                    </div>
                    {template.clients && template.clients.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        Assigned: {template.clients.map((c) => c.name).join(", ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openPreview(template)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(template)}>
                        Edit
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => openAssign(template)}>
                        Assign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signed" className="mt-6">
          {signedLoading ? (
            <Skeleton className="h-40" />
          ) : signedDocs.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No signed documents"
              description="Signed NDAs will appear here once clients complete signing."
            />
          ) : (
            <div className="space-y-3">
              {signedDocs.map(
                (doc: {
                  id: string;
                  signedAt?: string;
                  ndaTemplate?: { title?: string; version?: number };
                  client?: { name?: string; email?: string };
                  user?: { firstName?: string; lastName?: string };
                }) => (
                  <Card key={doc.id} className="glass-subtle">
                    <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {doc.ndaTemplate?.title || "NDA"}
                          {doc.ndaTemplate?.version ? ` · v${doc.ndaTemplate.version}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {doc.client?.name ||
                            [doc.user?.firstName, doc.user?.lastName].filter(Boolean).join(" ") ||
                            "Signer"}
                          {doc.client?.email ? ` · ${doc.client.email}` : ""}
                        </p>
                      </div>
                      <Badge variant="success">
                        Signed {doc.signedAt ? formatDate(doc.signedAt) : ""}
                      </Badge>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create template */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New NDA template</DialogTitle>
            <DialogDescription>
              Use placeholders{" "}
              <code className="text-xs">{"{{companyName}}"}</code>,{" "}
              <code className="text-xs">{"{{clientName}}"}</code>,{" "}
              <code className="text-xs">{"{{date}}"}</code>. Company name appears in the
              document header; client name appears in the signature block.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label>Template type</Label>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm((f) => ({ ...f, mode: v as "general" | "client" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General (reusable)</SelectItem>
                  <SelectItem value="client">Custom for one client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.mode === "client" && (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={form.clientId || "none"}
                  onValueChange={(v) => {
                    const client = clients.find((c) => c.id === v);
                    setForm((f) => ({
                      ...f,
                      clientId: v === "none" ? "" : v,
                      title: client ? `NDA — ${client.name}` : f.title,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Document content</Label>
              <Textarea
                className="min-h-[280px] font-mono text-xs leading-relaxed"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-2">Live preview</p>
              <pre className="text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-muted-foreground">
                {localPreview(
                  form.content,
                  "Your Company",
                  clients.find((c) => c.id === form.clientId)?.name || "Client Name",
                )}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !form.title.trim() ||
                !form.content.trim() ||
                (form.mode === "client" && !form.clientId) ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving..." : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit template */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit NDA template</DialogTitle>
            <DialogDescription>
              Update the full document text. Placeholders are replaced when assigned or signed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Document content</Label>
              <Textarea
                className="min-h-[280px] font-mono text-xs leading-relaxed"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign NDA to client</DialogTitle>
            <DialogDescription>
              Enables NDA in the client setup link. Company name fills the template header; client
              name fills the signature line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={assignForm.clientId || "none"}
                onValueChange={(v) =>
                  setAssignForm((f) => ({
                    ...f,
                    clientId: v === "none" ? "" : v,
                    customTitle:
                      v !== "none"
                        ? `NDA — ${clients.find((c) => c.id === v)?.name || "Client"}`
                        : f.customTitle,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignment type</Label>
              <Select
                value={assignForm.mode}
                onValueChange={(v) =>
                  setAssignForm((f) => ({ ...f, mode: v as "existing" | "custom" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Use existing template</SelectItem>
                  <SelectItem value="custom">Write custom NDA for this client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignForm.mode === "existing" ? (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={assignForm.templateId || "none"}
                  onValueChange={(v) =>
                    setAssignForm((f) => ({ ...f, templateId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select template</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title || t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Custom title</Label>
                  <Input
                    value={assignForm.customTitle}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, customTitle: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom NDA content</Label>
                  <Textarea
                    className="min-h-[240px] font-mono text-xs leading-relaxed"
                    value={assignForm.customContent}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, customContent: e.target.value }))
                    }
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !assignForm.clientId ||
                (assignForm.mode === "existing" && !assignForm.templateId) ||
                (assignForm.mode === "custom" && !assignForm.customContent.trim()) ||
                assignMutation.isPending
              }
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign NDA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title || selected?.name || "NDA preview"}</DialogTitle>
            <DialogDescription>
              Placeholders resolved with company and client names
            </DialogDescription>
          </DialogHeader>
          <NdaDocumentPreview
            content={previewText || ""}
            maxHeightClassName="max-h-[min(65vh,36rem)]"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

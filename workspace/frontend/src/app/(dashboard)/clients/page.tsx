"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientsApi, onboardingApi } from "@/lib/api";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  type?: "COMPANY" | "INDIVIDUAL";
  email?: string;
  phone?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  status: string;
  setupToken?: string | null;
  setupEnabled?: boolean;
  requireNda?: boolean;
  setupProgress?: {
    accountDone: boolean;
    formsDone: number;
    formsTotal: number;
    formsComplete: boolean;
    ndaDone: boolean;
    requireNda: boolean;
    setupComplete: boolean;
  };
  _count?: { projects?: number; formAssignments?: number };
}

type ClientTypeFilter = "ALL" | "COMPANY" | "INDIVIDUAL";

function publicFormUrl(token: string, clientId: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/onboarding/public/${token}?clientId=${clientId}`;
}

function setupInviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/setup/${token}`;
}

export default function ClientsPage() {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ClientTypeFilter>("ALL");
  const [form, setForm] = useState({
    type: "COMPANY",
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    onboardingMode: "none" as "none" | "assign" | "create",
    assignFormId: "",
    createFormTitle: "",
  });
  const [assignClient, setAssignClient] = useState<Client | null>(null);
  const [assignMode, setAssignMode] = useState<"assign" | "create">("assign");
  const [assignFormId, setAssignFormId] = useState("");
  const [createFormTitle, setCreateFormTitle] = useState("");
  const [formsClient, setFormsClient] = useState<Client | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["clients", typeFilter],
    queryFn: () =>
      clientsApi.list({
        ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
        limit: 100,
      }),
    retry: false,
  });

  const { data: formsData } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: () => onboardingApi.listForms(),
    retry: false,
  });

  const { data: clientFormsData, isLoading: clientFormsLoading } = useQuery({
    queryKey: ["clients", formsClient?.id, "onboarding-forms"],
    queryFn: () => clientsApi.listOnboardingForms(formsClient!.id),
    enabled: !!formsClient?.id,
    retry: false,
  });

  const clients: Client[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const catalogForms = useMemo(() => {
    const raw = formsData?.data?.data ?? formsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [formsData]);

  const clientAssignments = useMemo(() => {
    const raw = clientFormsData?.data?.data ?? clientFormsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientFormsData]);

  const createMutation = useMutation({
    mutationFn: () => {
      const type = form.type as "COMPANY" | "INDIVIDUAL";
      const name =
        type === "INDIVIDUAL"
          ? [form.firstName, form.lastName].filter(Boolean).join(" ") || form.name
          : form.companyName || form.name;
      return clientsApi.create({
        type,
        name,
        email: form.email,
        phone: form.phone || undefined,
        companyName: type === "COMPANY" ? form.companyName || name : undefined,
        firstName: type === "INDIVIDUAL" ? form.firstName || undefined : undefined,
        lastName: type === "INDIVIDUAL" ? form.lastName || undefined : undefined,
        ...(form.onboardingMode === "assign" && form.assignFormId
          ? { assignFormId: form.assignFormId }
          : {}),
        ...(form.onboardingMode === "create" && form.createFormTitle
          ? { createFormTitle: form.createFormTitle }
          : {}),
      });
    },
    onSuccess: (res) => {
      const mode = form.onboardingMode;
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created");
      setOpen(false);
      setForm({
        type: "COMPANY",
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        companyName: "",
        onboardingMode: "none",
        assignFormId: "",
        createFormTitle: "",
      });
      if (mode === "create") {
        const assignments = res?.data?.formAssignments ?? [];
        const formId = assignments[0]?.form?.id as string | undefined;
        if (formId) router.push(`/onboarding/${formId}/builder`);
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create client";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!assignClient) throw new Error("No client");
      if (assignMode === "assign") {
        return clientsApi.assignOnboardingForm(assignClient.id, {
          formId: assignFormId,
        });
      }
      return clientsApi.createOnboardingForm(assignClient.id, {
        title: createFormTitle || `${assignClient.name} onboarding`,
        publish: true,
      });
    },
    onSuccess: (res) => {
      const createdFormId =
        assignMode === "create" ? (res?.data?.form?.id as string | undefined) : undefined;
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (assignClient) {
        queryClient.invalidateQueries({
          queryKey: ["clients", assignClient.id, "onboarding-forms"],
        });
      }
      toast.success(
        assignMode === "assign" ? "Form assigned to client" : "Client form created",
      );
      setAssignClient(null);
      setAssignFormId("");
      setCreateFormTitle("");
      if (createdFormId) {
        router.push(`/onboarding/${createdFormId}/builder`);
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to assign form";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const copySetupLink = async (client: Client) => {
    try {
      let token = client.setupEnabled ? client.setupToken : null;
      if (!token) {
        const res = await clientsApi.enableSetup(client.id);
        const payload = res.data?.data ?? res.data;
        token = payload?.setupToken as string;
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      }
      if (!token) throw new Error("No setup token");
      await navigator.clipboard.writeText(setupInviteUrl(token));
      toast.success("Setup link copied");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not copy setup link";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  const toggleRequireNda = async (client: Client, requireNda: boolean) => {
    try {
      if (!client.setupEnabled) {
        await clientsApi.enableSetup(client.id);
      }
      await clientsApi.updateSetup(client.id, { requireNda });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(requireNda ? "NDA required in setup" : "NDA not required");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not update setup";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Companies and individuals — assign or create onboarding forms
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === "COMPANY" ? (
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    placeholder="Acme Ltd"
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        companyName: e.target.value,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="contact@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <Label>Onboarding form</Label>
                <Select
                  value={form.onboardingMode}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      onboardingMode: v as "none" | "assign" | "create",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None for now</SelectItem>
                    <SelectItem value="assign">Assign existing form</SelectItem>
                    <SelectItem value="create">Create form for this client</SelectItem>
                  </SelectContent>
                </Select>
                {form.onboardingMode === "assign" && (
                  <Select
                    value={form.assignFormId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, assignFormId: v === "none" ? "" : v }))
                    }
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
                )}
                {form.onboardingMode === "create" && (
                  <Input
                    placeholder="Form title"
                    value={form.createFormTitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, createFormTitle: e.target.value }))
                    }
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!form.email || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Saving..." : "Add Client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as ClientTypeFilter)}>
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="COMPANY">Company</TabsTrigger>
          <TabsTrigger value="INDIVIDUAL">Individual</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Add your first client and optionally assign an onboarding form."
          actionLabel="Add Client"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const isPerson = client.type === "INDIVIDUAL";
            const Icon = isPerson ? User : Building2;
            const progress = client.setupProgress;
            const accountDone = !!progress?.accountDone;
            const formsComplete = !!progress?.formsComplete;
            const formsSubmitted =
              formsComplete && (progress?.formsTotal ?? 0) > 0;
            const ndaDone = !!progress?.ndaDone;
            const requireNda = !!progress?.requireNda || !!client.requireNda;
            const setupComplete = !!progress?.setupComplete;
            const nextStepLabel = !accountDone
              ? null
              : !formsComplete
                ? "Next step: Complete forms"
                : requireNda && !ndaDone
                  ? "Next step: Sign NDA"
                  : null;

            return (
              <Card key={client.id} className="glass-subtle hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{client.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {isPerson ? "Individual" : "Company"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
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
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant={client.status === "active" ? "success" : "warning"}>
                      {client.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {client._count?.formAssignments ?? 0} forms ·{" "}
                      {client._count?.projects ?? 0} projects
                    </span>
                  </div>

                  {progress && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge
                        variant={accountDone ? "success" : "secondary"}
                        className="text-[10px] gap-0.5"
                      >
                        {accountDone && <CheckCircle2 className="h-3 w-3" />}
                        Account
                      </Badge>
                      <Badge
                        variant={formsComplete ? "success" : "secondary"}
                        className="text-[10px] gap-0.5"
                      >
                        {formsComplete && <CheckCircle2 className="h-3 w-3" />}
                        Forms {progress.formsDone}/{progress.formsTotal}
                      </Badge>
                      {requireNda && (
                        <Badge
                          variant={ndaDone ? "success" : "secondary"}
                          className="text-[10px] gap-0.5"
                        >
                          {ndaDone && <CheckCircle2 className="h-3 w-3" />}
                          NDA
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2">
                    <Label htmlFor={`nda-${client.id}`} className="text-xs font-normal">
                      Require NDA
                    </Label>
                    <Switch
                      id={`nda-${client.id}`}
                      checked={!!client.requireNda}
                      onCheckedChange={(v) => toggleRequireNda(client, v)}
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    {setupComplete ? (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Client setup complete
                      </div>
                    ) : (
                      <>
                        {accountDone && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            Account setup completed
                          </div>
                        )}

                        {formsSubmitted && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            Onboarding form submitted
                          </div>
                        )}

                        {requireNda && ndaDone && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            NDA signed
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {!accountDone && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs"
                              onClick={() => copySetupLink(client)}
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" />
                              Copy setup link
                            </Button>
                          )}

                          {!formsSubmitted && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setAssignClient(client);
                                  setAssignMode("assign");
                                  setAssignFormId("");
                                  setCreateFormTitle(`${client.name} onboarding`);
                                }}
                              >
                                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                                Assign form
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => setFormsClient(client)}
                              >
                                View forms
                              </Button>
                            </>
                          )}

                          {nextStepLabel && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs"
                              onClick={() => copySetupLink(client)}
                            >
                              {nextStepLabel}
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign / create form for existing client */}
      <Dialog
        open={!!assignClient}
        onOpenChange={(v) => {
          if (!v) setAssignClient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Onboarding for {assignClient?.name}
            </DialogTitle>
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
                <SelectItem value="create">Create form for this client</SelectItem>
              </SelectContent>
            </Select>
            {assignMode === "assign" ? (
              <Select value={assignFormId || "none"} onValueChange={(v) => setAssignFormId(v === "none" ? "" : v)}>
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
              <div className="space-y-2">
                <Label>Form title</Label>
                <Input
                  value={createFormTitle}
                  onChange={(e) => setCreateFormTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Creates a dedicated published form, then opens the builder so you can add fields.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignClient(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                assignMutation.isPending ||
                (assignMode === "assign" ? !assignFormId : !createFormTitle.trim())
              }
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List assigned forms + copy client-specific link */}
      <Dialog
        open={!!formsClient}
        onOpenChange={(v) => {
          if (!v) setFormsClient(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Forms for {formsClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {clientFormsLoading ? (
              <Skeleton className="h-20" />
            ) : clientAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No forms assigned yet. Use Assign form on the client card.
              </p>
            ) : (
              clientAssignments.map(
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
                  const link = publicFormUrl(a.form.secureToken, formsClient!.id);
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
                      {a.form.status === "PUBLISHED" ? (
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
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy client link
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                            <a href={link} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Publish the form to share a client link.
                        </p>
                      )}
                    </div>
                  );
                },
              )
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (formsClient) {
                  setAssignClient(formsClient);
                  setAssignMode("assign");
                  setFormsClient(null);
                }
              }}
            >
              Assign another
            </Button>
            <Button onClick={() => setFormsClient(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

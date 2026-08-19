"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Phone, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}

type ClientTypeFilter = "ALL" | "COMPANY" | "INDIVIDUAL";

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

  const clients: Client[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const catalogForms = useMemo(() => {
    const raw = formsData?.data?.data ?? formsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [formsData]);

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
      const clientId = res?.data?.id ?? res?.data?.data?.id;
      if (clientId) {
        router.push(`/clients/${clientId}`);
        return;
      }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Companies and individuals — open a client for projects, invoices, and activity
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
                <Label>Onboarding form (optional)</Label>
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
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Add your first client to manage projects, invoices, and documents."
          actionLabel="Add Client"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const isPerson = client.type === "INDIVIDUAL";
            const Icon = isPerson ? User : Building2;

            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="block group">
                <Card className="glass-subtle hover:shadow-md transition-shadow h-full cursor-pointer group-hover:border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                          {client.name}
                        </CardTitle>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {isPerson ? "Individual" : "Company"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {client.phone}
                      </div>
                    )}
                    <div className="pt-1">
                      <Badge variant={client.status === "active" ? "success" : "warning"}>
                        {client.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

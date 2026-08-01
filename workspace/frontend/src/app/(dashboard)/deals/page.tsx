"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
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
import { CrmViewControls } from "@/components/crm/CrmViewControls";
import { CrmKanbanBoard } from "@/components/crm/CrmKanbanBoard";
import { DEAL_STATUSES } from "@/components/crm/crm-constants";
import { clientsApi, dealsApi, leadsApi } from "@/lib/api";
import { toast } from "sonner";

interface Deal {
  id: string;
  title: string;
  amount?: string | number | null;
  status: string;
  client?: { id: string; name: string } | null;
  lead?: { id: string; title: string } | null;
}

export default function DealsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    status: "OPEN",
    clientId: "",
    leadId: "",
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: () => dealsApi.list({ limit: 100 }),
    retry: false,
  });
  const { data: pipelineData } = useQuery({
    queryKey: ["deals", "pipeline"],
    queryFn: () => dealsApi.pipeline(),
    retry: false,
  });
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "deal-picker"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    retry: false,
  });
  const { data: leadsData } = useQuery({
    queryKey: ["leads", "deal-picker"],
    queryFn: () => leadsApi.list({ limit: 100 }),
    retry: false,
  });

  const deals: Deal[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.client?.name?.toLowerCase().includes(q) ||
        d.lead?.title?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);
  const leads = useMemo(() => {
    const raw = leadsData?.data?.data ?? leadsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [leadsData]);
  const pipeline = pipelineData?.data?.data ?? pipelineData?.data;

  const createMutation = useMutation({
    mutationFn: () =>
      dealsApi.create({
        title: form.title,
        amount: form.amount ? Number(form.amount) : undefined,
        status: form.status,
        clientId: form.clientId || undefined,
        leadId: form.leadId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal created");
      setOpen(false);
      setForm({ title: "", amount: "", status: "OPEN", clientId: "", leadId: "" });
    },
    onError: () => toast.error("Failed to create deal"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      dealsApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
    onError: () => toast.error("Could not update deal"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground text-sm">
            Pipeline value: ${Number(pipeline?.pipelineValue ?? 0).toLocaleString()} (
            {pipeline?.pipelineCount ?? 0} open)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={form.clientId || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, clientId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select
                  value={form.leadId || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, leadId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leads.map((l: { id: string; title: string }) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!form.title || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <CrmViewControls
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals yet"
          description="Create deals from won leads or link them to clients."
          actionLabel="New Deal"
          onAction={() => setOpen(true)}
        />
      ) : view === "board" ? (
        <CrmKanbanBoard
          columns={DEAL_STATUSES.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
          }))}
          items={deals.map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.client?.name || d.lead?.title || undefined,
            meta: d.amount != null ? `$${Number(d.amount).toLocaleString()}` : undefined,
            href: "/deals",
            status: d.status,
          }))}
          onMove={(id, status) => moveMutation.mutate({ id, status })}
        />
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{deal.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[deal.client?.name, deal.lead?.title].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {deal.amount != null && (
                    <span className="text-sm font-medium">
                      ${Number(deal.amount).toLocaleString()}
                    </span>
                  )}
                  <Select
                    value={deal.status}
                    onValueChange={(v) => moveMutation.mutate({ id: deal.id, status: v })}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="sr-only">
                    {deal.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

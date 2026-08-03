"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Handshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DEAL_STAGE_PROBABILITY,
  DEAL_STATUSES,
} from "@/components/crm/crm-constants";
import { clientsApi, dealsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Deal {
  id: string;
  title: string;
  amount?: string | number | null;
  status: string;
  expectedCloseDate?: string | null;
  notes?: string | null;
  client?: { id: string; name: string } | null;
  lead?: { id: string; title: string } | null;
  owner?: { id: string; firstName?: string; lastName?: string } | null;
}

const emptyForm = {
  title: "",
  amount: "",
  status: "OPEN",
  clientId: "",
  expectedCloseDate: "",
  notes: "",
};

export default function DealsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const router = useRouter();

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
    enabled: open,
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

  const pipeline = pipelineData?.data?.data ?? pipelineData?.data;

  const weightedValue = useMemo(() => {
    return deals
      .filter((d) => !["WON", "LOST"].includes(d.status))
      .reduce((sum, d) => {
        const amount = Number(d.amount ?? 0);
        const prob = (DEAL_STAGE_PROBABILITY[d.status] ?? 0) / 100;
        return sum + amount * prob;
      }, 0);
  }, [deals]);

  const createMutation = useMutation({
    mutationFn: () =>
      dealsApi.create({
        title: form.title.trim(),
        amount: form.amount ? Number(form.amount) : undefined,
        status: form.status,
        clientId: form.clientId || undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
      toast.success("Deal created");
      setOpen(false);
      setForm(emptyForm);
      const created = res?.data?.data ?? res?.data;
      if (created?.id) router.push(`/deals/${created.id}`);
    },
    onError: () => toast.error("Failed to create deal"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      dealsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
    },
    onError: () => toast.error("Could not update deal stage"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">
            CRM
          </p>
          <h1 className="font-display text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground text-sm">
            Pipeline ${Number(pipeline?.pipelineValue ?? 0).toLocaleString()} ·{" "}
            {pipeline?.pipelineCount ?? 0} open · Weighted $
            {Math.round(weightedValue).toLocaleString()}
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
              <DialogTitle>Create deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Deal name</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Website redesign — Acme"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Deal value</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected close</Label>
                  <Input
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expectedCloseDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={form.clientId || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      clientId: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client yet</SelectItem>
                    {clients.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STATUSES.filter(
                      (s) => s.key !== "WON" && s.key !== "LOST",
                    ).map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label} ({DEAL_STAGE_PROBABILITY[s.key]}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Next steps, proposal notes…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!form.title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating…" : "Create deal"}
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
          description="Convert a won lead, or create a deal with value and expected close date."
          actionLabel="New Deal"
          onAction={() => setOpen(true)}
        />
      ) : view === "board" ? (
        <CrmKanbanBoard
          columns={DEAL_STATUSES.map((s) => {
            const colDeals = deals.filter((d) => d.status === s.key);
            const total = colDeals.reduce(
              (sum, d) => sum + Number(d.amount ?? 0),
              0,
            );
            return {
              key: s.key,
              label: s.label,
              color: s.color,
              footer:
                total > 0
                  ? `$${total.toLocaleString()} · ${DEAL_STAGE_PROBABILITY[s.key] ?? 0}%`
                  : `${DEAL_STAGE_PROBABILITY[s.key] ?? 0}% likely`,
            };
          })}
          items={deals.map((d) => {
            const prob = DEAL_STAGE_PROBABILITY[d.status] ?? 0;
            return {
              id: d.id,
              title: d.title,
              subtitle: d.client?.name || "No client assigned",
              meta:
                d.amount != null
                  ? `$${Number(d.amount).toLocaleString()}`
                  : undefined,
              detail: d.expectedCloseDate
                ? `Close ${formatDate(d.expectedCloseDate)}`
                : "No close date",
              badge: `${prob}%`,
              href: `/deals/${d.id}`,
              status: d.status,
            };
          })}
          onMove={(id, status) => moveMutation.mutate({ id, status })}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden sm:grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.9fr] gap-3 border-b px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Deal</span>
              <span>Client</span>
              <span>Value</span>
              <span>Close date</span>
              <span>Stage</span>
            </div>
            <div className="divide-y">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_0.9fr] sm:items-center"
                >
                  <div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="font-medium hover:underline"
                    >
                      {deal.title}
                    </Link>
                    {deal.lead?.title && (
                      <p className="text-xs text-muted-foreground">
                        From lead · {deal.lead.title}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {deal.client?.name || "—"}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    {deal.amount != null
                      ? `$${Number(deal.amount).toLocaleString()}`
                      : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {deal.expectedCloseDate
                      ? formatDate(deal.expectedCloseDate)
                      : "—"}
                  </p>
                  <Select
                    value={deal.status}
                    onValueChange={(v) =>
                      moveMutation.mutate({ id: deal.id, status: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

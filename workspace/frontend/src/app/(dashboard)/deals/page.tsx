"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  DollarSign,
  Handshake,
  MoreVertical,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEAL_STAGE_PROBABILITY,
  DEAL_STATUSES,
} from "@/components/crm/crm-constants";
import { clientsApi, dealsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

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

const OPEN_STAGES = new Set([
  "OPEN",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
]);

export default function DealsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();

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

  const allDeals: Deal[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const deals = useMemo(() => {
    let list = allDeals;
    if (stageFilter !== "ALL") {
      list = list.filter((d) => d.status === stageFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.client?.name?.toLowerCase().includes(q) ||
        d.lead?.title?.toLowerCase().includes(q),
    );
  }, [allDeals, search, stageFilter]);

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  const pipeline = pipelineData?.data?.data ?? pipelineData?.data;

  const stats = useMemo(() => {
    const openDeals = allDeals.filter((d) => OPEN_STAGES.has(d.status));
    const won = allDeals.filter((d) => d.status === "WON");
    const weighted = openDeals.reduce((sum, d) => {
      const amount = Number(d.amount ?? 0);
      const prob = (DEAL_STAGE_PROBABILITY[d.status] ?? 0) / 100;
      return sum + amount * prob;
    }, 0);
    const closingSoon = openDeals.filter((d) => {
      if (!d.expectedCloseDate) return false;
      const days =
        (new Date(d.expectedCloseDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 14;
    }).length;
    return {
      openValue: Number(pipeline?.pipelineValue ?? 0),
      openCount: Number(pipeline?.pipelineCount ?? openDeals.length),
      weighted: Math.round(weighted),
      wonValue: won.reduce((s, d) => s + Number(d.amount ?? 0), 0),
      wonCount: won.length,
      closingSoon,
    };
  }, [allDeals, pipeline]);

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

  const revertMutation = useMutation({
    mutationFn: ({
      id,
      destination,
    }: {
      id: string;
      destination: "board" | "leads";
    }) => dealsApi.revert(id, destination),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        vars.destination === "board"
          ? "Deal moved to the lead board"
          : "Deal moved to leads",
      );
    },
    onError: () => toast.error("Could not move this deal"),
  });

  const dealActions = (deal: Deal) => [
    {
      label: "Move to board",
      onSelect: () => revertMutation.mutate({ id: deal.id, destination: "board" }),
    },
    {
      label: "Move to leads",
      onSelect: () => revertMutation.mutate({ id: deal.id, destination: "leads" }),
    },
    {
      label: "Delete",
      destructive: true,
      onSelect: async () => {
        const ok = await confirm(trashConfirm("deal", deal.title));
        if (!ok) return;
        await dealsApi.remove(deal.id);
        queryClient.invalidateQueries({ queryKey: ["deals"] });
        queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
        toast.success("Deal moved to trash");
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Revenue pipeline
          </p>
          <h1 className="font-display text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Manage opportunities after a lead converts — track value, close date,
            and stage. Lead contact fields live on Leads, not here.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create opportunity</DialogTitle>
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
                  <Label>Deal value ($)</Label>
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
                <Label>Pipeline stage</Label>
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
                        {s.label} · {DEAL_STAGE_PROBABILITY[s.key]}% likely
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next steps</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Proposal sent, follow-up call…"
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="!shadow-sm border-teal-900/10 bg-gradient-to-br from-teal-50/80 to-background">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-teal-900/10 p-2 text-teal-800">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open pipeline</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                ${stats.openValue.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stats.openCount} open deals
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="!shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weighted forecast</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                ${stats.weighted.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                By stage likelihood
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="!shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Won</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                ${stats.wonValue.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stats.wonCount} closed won
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="!shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-700">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closing in 14 days</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {stats.closingSoon}
              </p>
              <p className="text-[11px] text-muted-foreground">Need attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={stageFilter === "ALL" ? "default" : "outline"}
          onClick={() => setStageFilter("ALL")}
        >
          All stages
        </Button>
        {DEAL_STATUSES.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={stageFilter === s.key ? "default" : "outline"}
            onClick={() => setStageFilter(s.key)}
          >
            {s.label}
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {allDeals.filter((d) => d.status === s.key).length}
            </Badge>
          </Button>
        ))}
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
      ) : allDeals.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals in the pipeline"
          description="Convert a lead to a deal, or create an opportunity with value and an expected close date."
          actionLabel="New deal"
          onAction={() => setOpen(true)}
        />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals match"
          description="Try another stage filter or search."
          actionLabel="Clear filters"
          onAction={() => {
            setStageFilter("ALL");
            setSearch("");
          }}
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
                  : "No value set",
              detail: d.expectedCloseDate
                ? `Close ${formatDate(d.expectedCloseDate)}`
                : "Set close date",
              badge: `${prob}%`,
              href: `/deals/${d.id}`,
              status: d.status,
              actions: dealActions(d),
            };
          })}
          onMove={(id, status) => moveMutation.mutate({ id, status })}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden sm:grid grid-cols-[1.5fr_1fr_0.8fr_1fr_0.7fr_0.9fr_auto] gap-3 border-b px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Deal</span>
              <span>Client</span>
              <span>Value</span>
              <span>Close date</span>
              <span>Likely</span>
              <span>Stage</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y">
              {deals.map((deal) => {
                const prob = DEAL_STAGE_PROBABILITY[deal.status] ?? 0;
                return (
                  <div
                    key={deal.id}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[1.5fr_1fr_0.8fr_1fr_0.7fr_0.9fr_auto] sm:items-center"
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
                          Converted from · {deal.lead.title}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {deal.client?.name || "—"}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {deal.amount != null
                        ? `$${Number(deal.amount).toLocaleString()}`
                        : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      {deal.expectedCloseDate
                        ? formatDate(deal.expectedCloseDate)
                        : "—"}
                    </p>
                    <p className="text-sm tabular-nums">{prob}%</p>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Deal actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {dealActions(deal).map((action) => (
                          <DropdownMenuItem
                            key={action.label}
                            className={
                              action.destructive
                                ? "text-destructive focus:text-destructive"
                                : undefined
                            }
                            onSelect={action.onSelect}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Handshake,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
  DEAL_LOST_REASONS,
  DEAL_STAGE_PROBABILITY,
  DEAL_STATUSES,
} from "@/components/crm/crm-constants";
import { clientsApi, dealsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function DealDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<string>(DEAL_LOST_REASONS[0]);
  const [lostNotes, setLostNotes] = useState("");
  const [form, setForm] = useState({
    title: "",
    amount: "",
    status: "OPEN",
    clientId: "",
    expectedCloseDate: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: () => dealsApi.get(id),
    retry: false,
  });

  const deal = data?.data?.data ?? data?.data ?? null;

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "deal-detail"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: Boolean(deal),
    retry: false,
  });

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  useEffect(() => {
    if (!deal) return;
    setForm({
      title: deal.title || "",
      amount: deal.amount != null ? String(deal.amount) : "",
      status: deal.status || "OPEN",
      clientId: deal.clientId || deal.client?.id || "",
      expectedCloseDate: deal.expectedCloseDate
        ? String(deal.expectedCloseDate).slice(0, 10)
        : "",
      notes: deal.notes || "",
    });
  }, [deal?.id, deal?.updatedAt]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      dealsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal", id] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
      toast.success("Deal updated");
    },
    onError: () => toast.error("Failed to update deal"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal deleted");
      router.push("/deals");
    },
    onError: () => toast.error("Failed to delete deal"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <EmptyState
        icon={Handshake}
        title="Deal not found"
        description="This deal doesn't exist or you don't have access."
        actionLabel="Back to deals"
        actionHref="/deals"
      />
    );
  }

  const prob = DEAL_STAGE_PROBABILITY[deal.status] ?? 0;
  const amount = Number(deal.amount ?? 0);
  const weighted = Math.round((amount * prob) / 100);

  const save = () => {
    updateMutation.mutate({
      title: form.title.trim(),
      amount: form.amount ? Number(form.amount) : undefined,
      status: form.status,
      clientId: form.clientId || null,
      expectedCloseDate: form.expectedCloseDate || null,
      notes: form.notes.trim() || null,
    });
  };

  const markWon = () => {
    updateMutation.mutate({
      status: "WON",
      expectedCloseDate:
        form.expectedCloseDate || new Date().toISOString().slice(0, 10),
    });
    setForm((f) => ({ ...f, status: "WON" }));
  };

  const markLost = () => {
    updateMutation.mutate({
      status: "LOST",
      lostReason,
      lostNotes: lostNotes.trim() || undefined,
    });
    setForm((f) => ({ ...f, status: "LOST" }));
    setLostOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/deals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{deal.status}</Badge>
              <Badge variant="secondary">{prob}% likely</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold">{deal.title}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                deal.client?.name,
                deal.lead?.title ? `Lead: ${deal.lead.title}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Opportunity"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {deal.status !== "WON" && deal.status !== "LOST" && (
            <>
              <Button onClick={markWon} disabled={updateMutation.isPending}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Mark won
              </Button>
              <Button variant="outline" onClick={() => setLostOpen(true)}>
                <XCircle className="mr-1 h-4 w-4" /> Mark lost
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Delete this deal?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Deal name</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deal value</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected close date</Label>
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
              <div className="grid gap-3 sm:grid-cols-2">
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
                      {DEAL_STATUSES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label} ({DEAL_STAGE_PROBABILITY[s.key]}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <SelectValue />
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
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes / next steps</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={4}
                />
              </div>
              <Button onClick={save} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Value</span>
                <span className="tabular-nums font-semibold">
                  ${amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Stage likelihood</span>
                <span>{prob}%</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Weighted value</span>
                <span className="tabular-nums font-medium">
                  ${weighted.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> Close
                </span>
                <span>
                  {deal.expectedCloseDate
                    ? formatDate(deal.expectedCloseDate)
                    : "—"}
                </span>
              </div>
              {deal.client?.name && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/clients">View clients</Link>
                </Button>
              )}
              {deal.lead?.id && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link href={`/leads/${deal.lead.id}`}>View source lead</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {(deal.lostReason || deal.status === "LOST") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lost reason</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{deal.lostReason || "—"}</p>
                {deal.lostNotes && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {deal.lostNotes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark deal as lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={lostNotes}
                onChange={(e) => setLostNotes(e.target.value)}
                rows={3}
                placeholder="What happened?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={markLost}
              disabled={updateMutation.isPending}
            >
              Confirm lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

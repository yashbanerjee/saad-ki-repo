"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CrmKanbanBoard } from "@/components/crm/CrmKanbanBoard";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/components/crm/crm-constants";
import { leadsApi } from "@/lib/api";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

interface Lead {
  id: string;
  title: string;
  name: string;
  email?: string | null;
  organizationName?: string | null;
  type: string;
  status: string;
  source: string;
  estimatedValue?: string | number | null;
  _count?: { emails?: number; crmNotes?: number; crmTasks?: number; activities?: number };
}

export default function LeadsBoardPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    name: "",
    email: "",
    phone: "",
    organizationName: "",
    type: "COMPANY",
    source: "OTHER",
    estimatedValue: "",
    notes: "",
  });
  const queryClient = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "board", search],
    queryFn: () =>
      leadsApi.list({ limit: 100, onBoard: true, search: search || undefined }),
    retry: false,
  });

  const leads: Lead[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const createMutation = useMutation({
    mutationFn: () =>
      leadsApi.create({
        title: form.title || form.name,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        organizationName: form.organizationName || undefined,
        type: form.type,
        source: form.source,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        notes: form.notes || undefined,
        onBoard: true,
      }),
    onSuccess: async () => {
      setOpen(false);
      setForm({
        title: "",
        name: "",
        email: "",
        phone: "",
        organizationName: "",
        type: "COMPANY",
        source: "OTHER",
        estimatedValue: "",
        notes: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.refetchQueries({ queryKey: ["leads", "board"] });
      toast.success("Lead added to board");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create lead";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadsApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Could not update status"),
  });

  const toInboxMutation = useMutation({
    mutationFn: (ids: string[]) => leadsApi.removeFromBoard(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead moved back to Leads");
    },
    onError: () => toast.error("Could not move lead to inbox"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => leadsApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead moved to trash");
    },
    onError: () => toast.error("Could not delete lead"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Board</h1>
          <p className="text-muted-foreground text-sm">
            Pipeline for leads moved from the Leads list
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/leads">
              <Target className="h-4 w-4 mr-1" /> All leads
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create lead on board</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={form.source}
                      onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={form.organizationName}
                    onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
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
                </div>
                <div className="space-y-2">
                  <Label>Estimated Value</Label>
                  <Input
                    type="number"
                    value={form.estimatedValue}
                    onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!form.name || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Saving..." : "Create on board"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Input
        placeholder="Search board..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No leads on the board yet"
          description="Import or select leads from the Leads list and move them here."
          actionLabel="Go to Leads"
          onAction={() => router.push("/leads")}
        />
      ) : (
        <CrmKanbanBoard
          columns={LEAD_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
          items={leads.map((l) => ({
            id: l.id,
            title: l.title,
            subtitle: [l.name, l.organizationName].filter(Boolean).join(" · "),
            meta: l.estimatedValue != null ? `$${Number(l.estimatedValue).toLocaleString()}` : undefined,
            href: `/leads/${l.id}`,
            status: l.status,
            counts: {
              emails: l._count?.emails,
              notes: l._count?.crmNotes,
              tasks: l._count?.crmTasks,
            },
            actions: [
              {
                label: "Move to leads",
                onSelect: () => toInboxMutation.mutate([l.id]),
              },
              {
                label: "Delete",
                destructive: true,
                onSelect: async () => {
                  const ok = await confirm(trashConfirm("lead", l.title));
                  if (ok) deleteMutation.mutate([l.id]);
                },
              },
            ],
          }))}
          onMove={(id, status) => moveMutation.mutate({ id, status })}
        />
      )}
    </div>
  );
}

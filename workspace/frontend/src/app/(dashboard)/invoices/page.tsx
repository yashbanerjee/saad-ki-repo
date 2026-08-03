"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Receipt,
  Send,
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  ExternalLink,
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
import { clientsApi, invoicesApi, projectsApi } from "@/lib/api";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type BillingType = "MILESTONE" | "HOURLY" | "TASK" | "CUSTOM";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const statusVariant: Record<string, "secondary" | "info" | "success" | "destructive" | "warning"> = {
  DRAFT: "secondary",
  SENT: "info",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "warning",
};

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const canManage = !isClient && (user?.role === "admin" || user?.role === "manager");

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("MILESTONE");
  const [currency, setCurrency] = useState("AED");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("1");
  const [rate, setRate] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesApi.list({ limit: 100 }),
    retry: false,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "invoice-form"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: canManage && open,
    retry: false,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "invoice-form"],
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: canManage && open,
    retry: false,
  });

  const { data: milestonesData } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => projectsApi.listMilestones(projectId),
    enabled: canManage && open && Boolean(projectId) && billingType === "MILESTONE",
    retry: false,
  });

  const invoices = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const clients = useMemo(() => {
    const raw = clientsData?.data?.data ?? clientsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [clientsData]);

  const projects = useMemo(() => {
    const raw = projectsData?.data?.data ?? projectsData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [projectsData]);

  const milestones = useMemo(() => {
    const raw = milestonesData?.data?.data ?? milestonesData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [milestonesData]);

  const resetForm = () => {
    setTitle("");
    setClientId("");
    setProjectId("");
    setMilestoneId("");
    setBillingType("MILESTONE");
    setCurrency("AED");
    setDueDate("");
    setNotes("");
    setAmount("");
    setHours("1");
    setRate("");
    setLineDesc("");
    setItems([]);
    setPdfFile(null);
  };

  const buildItems = (): LineItem[] => {
    if (billingType === "HOURLY") {
      const qty = Number(hours) || 0;
      const unitPrice = Number(rate) || 0;
      return [
        {
          description: lineDesc.trim() || "Professional services (hourly)",
          quantity: qty,
          unitPrice,
        },
      ];
    }
    if (billingType === "MILESTONE") {
      const ms = milestones.find((m: { id: string }) => m.id === milestoneId);
      return [
        {
          description:
            lineDesc.trim() ||
            (ms ? `Milestone: ${ms.name}` : "Milestone payment"),
          quantity: 1,
          unitPrice: Number(amount) || 0,
        },
      ];
    }
    if (billingType === "TASK") {
      if (items.length) return items;
      return [
        {
          description: lineDesc.trim() || "Task-based work",
          quantity: 1,
          unitPrice: Number(amount) || 0,
        },
      ];
    }
    return items.length
      ? items
      : [
          {
            description: lineDesc.trim() || "Invoice item",
            quantity: 1,
            unitPrice: Number(amount) || 0,
          },
        ];
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const built = buildItems();
      const total = built.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      return invoicesApi.createWithPdf({
        clientId,
        projectId: projectId || undefined,
        milestoneId: billingType === "MILESTONE" ? milestoneId || undefined : undefined,
        title: title.trim() || undefined,
        billingType,
        currency,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        amount: total || Number(amount) || 0,
        items: built,
        file: pdfFile || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      resetForm();
      toast.success("Invoice created");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create invoice");
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent to client");
    },
    onError: () => toast.error("Failed to send invoice"),
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.markPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Marked as paid");
    },
    onError: () => toast.error("Failed to update invoice"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: () => toast.error("Failed to delete invoice"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">
            {isClient
              ? "View invoices sent for your projects"
              : "Create milestone, hourly, or task invoices — upload PDF or build in-app"}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> New invoice
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description={
            isClient
              ? "When your vendor sends an invoice, it will appear here."
              : "Create an invoice for a client project — milestone, hourly, or task based."
          }
          actionLabel={canManage ? "Create invoice" : undefined}
          onAction={canManage ? () => setOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {invoices.map(
            (inv: {
              id: string;
              number: string;
              title: string;
              status: string;
              billingType: string;
              amount: number;
              currency: string;
              dueDate?: string;
              pdfStorageUrl?: string | null;
              pdfName?: string | null;
              client?: { name?: string };
              project?: { name?: string };
            }) => (
              <Card key={inv.id} className="!shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium hover:underline"
                      >
                        {inv.number} · {inv.title}
                      </Link>
                      <Badge variant={statusVariant[inv.status] || "secondary"}>
                        {inv.status}
                      </Badge>
                      <Badge variant="outline">{inv.billingType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[inv.client?.name, inv.project?.name].filter(Boolean).join(" · ")}
                      {inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}
                    </p>
                    {inv.pdfName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {inv.pdfName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold tabular-nums mr-2">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </p>
                    {inv.pdfStorageUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={inv.pdfStorageUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" /> PDF
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/invoices/${inv.id}`}>Open</Link>
                    </Button>
                    {canManage && inv.status === "DRAFT" && (
                      <Button
                        size="sm"
                        onClick={() => sendMutation.mutate(inv.id)}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Send
                      </Button>
                    )}
                    {canManage && inv.status === "SENT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => paidMutation.mutate(inv.id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Paid
                      </Button>
                    )}
                    {canManage && inv.status === "DRAFT" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(inv.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Billing type</Label>
              <Select
                value={billingType}
                onValueChange={(v) => setBillingType(v as BillingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MILESTONE">Milestone</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="TASK">Task based</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sensia Phase 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select
                value={projectId || "__none__"}
                onValueChange={(v) => {
                  const next = v === "__none__" ? "" : v;
                  setProjectId(next);
                  setMilestoneId("");
                  if (next) {
                    const p = projects.find((x: { id: string; clientId?: string }) => x.id === next);
                    if (p?.clientId) setClientId(p.clientId);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.map((p: { id: string; name: string; clientId?: string }) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {billingType === "MILESTONE" && projectId && (
              <div className="space-y-2">
                <Label>Milestone</Label>
                <Select value={milestoneId} onValueChange={setMilestoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    {milestones.map((m: { id: string; name: string }) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {billingType === "HOURLY" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate ({currency})</Label>
                  <Input
                    type="number"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Amount ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Line description</Label>
              <Input
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                placeholder="What is this invoice for?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment terms, bank details…"
              />
            </div>

            <div className="space-y-2">
              <Label>Upload invoice PDF (optional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {pdfFile ? pdfFile.name : "Choose PDF"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                You can create the invoice in-app and/or attach a PDF to send to the client.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!clientId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

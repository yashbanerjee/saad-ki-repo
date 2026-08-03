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
  Download,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const statusVariant: Record<
  string,
  "secondary" | "info" | "success" | "destructive" | "warning"
> = {
  DRAFT: "secondary",
  SENT: "info",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "warning",
};

const emptyLine = (): LineItem => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const canManage =
    !isClient && (user?.role === "admin" || user?.role === "manager");

  const [open, setOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("CUSTOM");
  const [currency, setCurrency] = useState("AED");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesApi.list({ limit: 100 }),
    retry: false,
  });

  const { data: nextNumberData } = useQuery({
    queryKey: ["invoices", "next-number"],
    queryFn: () => invoicesApi.nextNumber(),
    enabled: canManage && open,
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
    enabled:
      canManage && open && Boolean(projectId) && billingType === "MILESTONE",
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

  const suggestedNumber =
    nextNumberData?.data?.number ??
    nextNumberData?.data?.data?.number ??
    "";

  const displayNumber = invoiceNumber.trim() || suggestedNumber;

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, row) =>
          sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0),
        0,
      ),
    [items],
  );

  const resetForm = () => {
    setInvoiceNumber("");
    setTitle("");
    setClientId("");
    setProjectId("");
    setMilestoneId("");
    setBillingType("CUSTOM");
    setCurrency("AED");
    setDueDate("");
    setNotes("");
    setItems([emptyLine()]);
    setPdfFile(null);
  };

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const built = items
        .map((row) => ({
          description: row.description.trim() || "Line item",
          quantity: Number(row.quantity) || 0,
          unitPrice: Number(row.unitPrice) || 0,
        }))
        .filter((row) => row.quantity > 0 || row.unitPrice > 0 || row.description);

      if (!built.length) {
        throw new Error("Add at least one line item");
      }

      const total = built.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      return invoicesApi.createWithPdf({
        clientId,
        number: displayNumber || undefined,
        projectId: projectId || undefined,
        milestoneId:
          billingType === "MILESTONE" ? milestoneId || undefined : undefined,
        title: title.trim() || undefined,
        billingType,
        currency,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        amount: total,
        items: built,
        file: pdfFile || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      resetForm();
      toast.success("Invoice created — PDF ready to download");
    },
    onError: (err: { message?: string; response?: { data?: { message?: string } } }) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to create invoice",
      );
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

  const downloadMutation = useMutation({
    mutationFn: ({ id, number }: { id: string; number: string }) =>
      invoicesApi.downloadPdf(id, `${number}.pdf`),
    onError: () => toast.error("Failed to download PDF"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">
            {isClient
              ? "View and download invoices sent for your projects"
              : "Build professional invoices with line items, invoice numbers, and PDF download"}
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
              : "Create an invoice with line items — then download a professional PDF."
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
                      {[inv.client?.name, inv.project?.name]
                        .filter(Boolean)
                        .join(" · ")}
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadMutation.isPending}
                      onClick={() =>
                        downloadMutation.mutate({
                          id: inv.id,
                          number: inv.number,
                        })
                      }
                    >
                      <Download className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>
                    {inv.pdfStorageUrl && (
                      <Button size="sm" variant="ghost" asChild>
                        <a
                          href={inv.pdfStorageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input
                  value={invoiceNumber || suggestedNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-0001"
                />
              </div>
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
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                    <SelectItem value="MILESTONE">Milestone</SelectItem>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                    <SelectItem value="TASK">Task based</SelectItem>
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
                      const p = projects.find(
                        (x: { id: string; clientId?: string }) => x.id === next,
                      );
                      if (p?.clientId) setClientId(p.clientId);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map(
                      (p: { id: string; name: string; clientId?: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setItems((prev) => [...prev, emptyLine()])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="w-24 px-2 py-2 font-medium">Qty</th>
                      <th className="w-32 px-2 py-2 font-medium">Rate</th>
                      <th className="w-28 px-2 py-2 font-medium text-right">
                        Amount
                      </th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, index) => {
                      const line =
                        (Number(row.quantity) || 0) *
                        (Number(row.unitPrice) || 0);
                      return (
                        <tr key={index} className="border-t">
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.description}
                              onChange={(e) =>
                                updateItem(index, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Item or service"
                              className="h-9"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.25"
                              value={row.quantity}
                              onChange={(e) =>
                                updateItem(index, {
                                  quantity: Number(e.target.value),
                                })
                              }
                              className="h-9"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unitPrice}
                              onChange={(e) =>
                                updateItem(index, {
                                  unitPrice: Number(e.target.value),
                                })
                              }
                              className="h-9"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                            {line.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-1 py-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={items.length <= 1}
                              onClick={() =>
                                setItems((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1 rounded-md border bg-muted/30 px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {currency}{" "}
                      {subtotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {currency}{" "}
                      {subtotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
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
              <Label>Notes / payment terms</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment terms, bank details…"
              />
            </div>

            <div className="space-y-2">
              <Label>Upload custom PDF (optional)</Label>
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
                {pdfFile ? pdfFile.name : "Choose PDF (or auto-generate on create)"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Leave empty to auto-generate a professional invoice PDF you can
                download anytime.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!clientId || createMutation.isPending || subtotal <= 0}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create & generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

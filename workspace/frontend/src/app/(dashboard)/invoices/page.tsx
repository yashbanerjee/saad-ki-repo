"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Receipt,
  Send,
  Upload,
  CheckCircle2,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  Eye,
  FileText,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

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

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const canManage =
    !isClient && (user?.role === "admin" || user?.role === "manager");
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [listClientFilter, setListClientFilter] = useState("all");
  const [listStatusFilter, setListStatusFilter] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", listClientFilter, listStatusFilter],
    queryFn: () =>
      invoicesApi.list({
        limit: 100,
        clientId: listClientFilter !== "all" ? listClientFilter : undefined,
        status: listStatusFilter !== "all" ? listStatusFilter : undefined,
      }),
    retry: false,
  });

  const { data: nextNumberData } = useQuery({
    queryKey: ["invoices", "next-number"],
    queryFn: () => invoicesApi.nextNumber(),
    enabled: canManage && open,
    retry: false,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients", "invoice-filter"],
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: !isClient,
    retry: false,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "invoice-form"],
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: canManage && open,
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
    const list = Array.isArray(raw) ? raw : [];
    if (!clientId) return list;
    return list.filter(
      (p: { clientId?: string | null }) => p.clientId === clientId,
    );
  }, [projectsData, clientId]);

  const suggestedNumber =
    nextNumberData?.data?.number ??
    nextNumberData?.data?.data?.number ??
    "…";

  const resetForm = () => {
    setTitle("");
    setClientId("");
    setProjectId("");
    setCurrency("AED");
    setAmount("");
    setDueDate("");
    setNotes("");
    setPdfFile(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!pdfFile) throw new Error("Please upload an invoice PDF");
      if (!clientId) throw new Error("Please select a client");
      if (!dueDate) throw new Error("Please set the payment due date");

      return invoicesApi.createWithPdf({
        clientId,
        projectId: projectId || undefined,
        title: title.trim() || pdfFile.name.replace(/\.pdf$/i, "") || undefined,
        billingType: "CUSTOM",
        currency,
        dueDate,
        notes: notes.trim() || undefined,
        amount: amount ? Number(amount) : 0,
        file: pdfFile,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "next-number"] });
      setOpen(false);
      resetForm();
      toast.success("Invoice uploaded and assigned");
    },
    onError: (err: {
      message?: string;
      response?: { data?: { message?: string } };
    }) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload invoice",
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
      toast.success("Moved to trash");
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
              : "Upload invoice PDFs, assign to a client project, and set the payment due date"}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Upload invoice
          </Button>
        )}
      </div>

      {!isClient && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={listClientFilter} onValueChange={setListClientFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clientsLoading ? (
                <SelectItem value="__loading" disabled>
                  Loading Clients...
                </SelectItem>
              ) : clients.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  No Clients Found
                </SelectItem>
              ) : (
                clients.map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {(listClientFilter !== "all" || listStatusFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setListClientFilter("all");
                setListStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

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
              : "Upload an invoice PDF and assign it to a client and project."
          }
          actionLabel={canManage ? "Upload invoice" : undefined}
          onAction={canManage ? () => setOpen(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11">Invoice</TableHead>
                  <TableHead className="hidden h-11 md:table-cell">Client</TableHead>
                  <TableHead className="hidden h-11 lg:table-cell">Due</TableHead>
                  <TableHead className="h-11">Status</TableHead>
                  <TableHead className="h-11 text-right">Amount</TableHead>
                  <TableHead className="h-11 w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(
                  (inv: {
                    id: string;
                    number: string;
                    title: string;
                    status: string;
                    amount: number;
                    currency: string;
                    dueDate?: string;
                    pdfStorageUrl?: string | null;
                    pdfName?: string | null;
                    client?: { name?: string };
                    project?: { name?: string };
                  }) => (
                    <TableRow key={inv.id} className="h-14">
                      <TableCell className="py-2.5">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="flex min-w-0 items-baseline gap-2 hover:underline"
                        >
                          <span className="shrink-0 font-mono text-sm font-semibold">
                            {inv.number}
                          </span>
                          <span className="truncate text-sm text-muted-foreground">
                            {inv.title}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden py-2.5 md:table-cell">
                        <div className="max-w-[240px] truncate text-sm">
                          {inv.client?.name || "—"}
                          {inv.project?.name ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {inv.project.name}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-2.5 whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant={statusVariant[inv.status] || "secondary"}
                          className="capitalize"
                        >
                          {inv.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                        {inv.currency} {Number(inv.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex flex-nowrap items-center justify-end gap-0.5">
                          {inv.pdfStorageUrl ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              asChild
                            >
                              <a
                                href={inv.pdfStorageUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                          {canManage && inv.status === "DRAFT" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Send to client"
                              onClick={() => sendMutation.mutate(inv.id)}
                              disabled={sendMutation.isPending}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {canManage && inv.status === "SENT" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Mark as paid"
                              onClick={() => paidMutation.mutate(inv.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="More"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/invoices/${inv.id}`}>
                                  <Eye className="h-4 w-4" /> Open
                                </Link>
                              </DropdownMenuItem>
                              {inv.pdfStorageUrl ? (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={inv.pdfStorageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" /> Open PDF
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              {canManage && inv.status === "DRAFT" ? (
                                <DropdownMenuItem
                                  onClick={() => sendMutation.mutate(inv.id)}
                                >
                                  <Send className="h-4 w-4" /> Send to client
                                </DropdownMenuItem>
                              ) : null}
                              {canManage && inv.status === "SENT" ? (
                                <DropdownMenuItem
                                  onClick={() => paidMutation.mutate(inv.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" /> Mark as paid
                                </DropdownMenuItem>
                              ) : null}
                              {canManage && inv.status === "DRAFT" ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={async () => {
                                      const ok = await confirm(
                                        trashConfirm(
                                          "invoice",
                                          `${inv.number} · ${inv.title}`,
                                        ),
                                      );
                                      if (ok) deleteMutation.mutate(inv.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Invoice number</Label>
              <Input
                value={suggestedNumber}
                readOnly
                disabled
                className="bg-muted font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Auto-generated when you upload.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invoice PDF</Label>
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
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setProjectId("");
                }}
              >
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
              <Label>Project</Label>
              <Select
                value={projectId || "__none__"}
                onValueChange={(v) =>
                  setProjectId(v === "__none__" ? "" : v)
                }
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      clientId ? "Select project" : "Select a client first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.map((p: { id: string; name: string }) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
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
            </div>

            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sensia Phase 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment terms, bank details…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !pdfFile ||
                !clientId ||
                !dueDate ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Uploading…" : "Upload & assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

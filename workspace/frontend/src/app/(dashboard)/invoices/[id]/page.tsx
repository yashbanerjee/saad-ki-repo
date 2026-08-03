"use client";

import { useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Receipt,
  Send,
  Upload,
  CheckCircle2,
  ExternalLink,
  FileText,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { invoicesApi } from "@/lib/api";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const canManage = !isClient;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.get(id),
    retry: false,
  });

  const invoice = data?.data?.data ?? data?.data ?? null;

  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent to client");
    },
    onError: () => toast.error("Failed to send invoice"),
  });

  const paidMutation = useMutation({
    mutationFn: () => invoicesApi.markPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Marked as paid");
    },
    onError: () => toast.error("Failed to update"),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => invoicesApi.uploadPdf(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("PDF uploaded");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Upload failed");
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (filename: string) => invoicesApi.downloadPdf(id, filename),
    onError: () => toast.error("Failed to download PDF"),
  });

  const generateMutation = useMutation({
    mutationFn: () => invoicesApi.generatePdf(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("PDF generated");
    },
    onError: () => toast.error("Failed to generate PDF"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <EmptyState
        icon={Receipt}
        title="Invoice not found"
        description="This invoice doesn't exist or you don't have access."
        actionLabel="Back to invoices"
        actionHref="/invoices"
      />
    );
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{invoice.number}</span>
              <Badge variant="outline">{invoice.billingType}</Badge>
              <Badge>{invoice.status}</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold">{invoice.title}</h1>
            <p className="text-sm text-muted-foreground">
              {[invoice.client?.name, invoice.project?.name].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={downloadMutation.isPending}
              onClick={() =>
                downloadMutation.mutate(`${invoice.number || "invoice"}.pdf`)
              }
            >
              <Download className="mr-1 h-4 w-4" />
              {downloadMutation.isPending ? "Downloading…" : "Download PDF"}
            </Button>
            {invoice.status === "DRAFT" && (
              <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                <Send className="mr-1 h-4 w-4" /> Send to client
              </Button>
            )}
            {invoice.status === "SENT" && (
              <Button variant="outline" onClick={() => paidMutation.mutate()}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Mark paid
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              disabled={uploadMutation.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload PDF"}
            </Button>
            <Button
              variant="outline"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <FileText className="mr-1 h-4 w-4" />
              {generateMutation.isPending ? "Generating…" : "Regenerate PDF"}
            </Button>
          </div>
        )}
        {isClient && (
          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() =>
              downloadMutation.mutate(`${invoice.number || "invoice"}.pdf`)
            }
          >
            <Download className="mr-1 h-4 w-4" />
            {downloadMutation.isPending ? "Downloading…" : "Download PDF"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items.</p>
              ) : (
                items.map(
                  (
                    item: { description?: string; quantity?: number; unitPrice?: number },
                    idx: number,
                  ) => {
                    const qty = Number(item.quantity ?? 1);
                    const price = Number(item.unitPrice ?? 0);
                    return (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {qty} × {invoice.currency} {price.toLocaleString()}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {invoice.currency} {(qty * price).toLocaleString()}
                        </p>
                      </div>
                    );
                  },
                )
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {invoice.currency} {Number(invoice.amount).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Client</span>
                <span className="text-right">{invoice.client?.name || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right">{invoice.project?.name || "—"}</span>
              </div>
              {invoice.milestone?.name && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Milestone</span>
                  <span className="text-right">{invoice.milestone.name}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Due</span>
                <span>{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Sent</span>
                <span>{invoice.sentAt ? formatDate(invoice.sentAt) : "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="default"
                disabled={downloadMutation.isPending}
                onClick={() =>
                  downloadMutation.mutate(`${invoice.number || "invoice"}.pdf`)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download invoice PDF
              </Button>
              {invoice.pdfStorageUrl ? (
                <Button className="w-full" variant="outline" asChild>
                  <a href={invoice.pdfStorageUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {invoice.pdfName || "Open stored PDF"}
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No stored PDF yet — download generates one on the fly.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
      toast.success("PDF replaced");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Upload failed");
    },
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
              <span className="font-mono text-sm text-muted-foreground">
                {invoice.number}
              </span>
              <Badge>{invoice.status}</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold">{invoice.title}</h1>
            <p className="text-sm text-muted-foreground">
              Client: {invoice.client?.name || "—"}
              {invoice.project?.name ? ` · ${invoice.project.name}` : ""}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {invoice.status === "DRAFT" && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
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
                if (!file) return;
                if (file.size > 100 * 1024 * 1024) {
                  toast.error(`${file.name} is over 100 MB`);
                  e.target.value = "";
                  return;
                }
                uploadMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              disabled={uploadMutation.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploadMutation.isPending ? "Uploading…" : "Replace PDF"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Invoice PDF
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.pdfStorageUrl ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {invoice.pdfName || "invoice.pdf"}
                  </p>
                  <Button asChild>
                    <a
                      href={invoice.pdfStorageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open / download PDF
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No PDF uploaded yet.
                </p>
              )}
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
              <CardTitle className="text-sm">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Client</span>
                <span className="text-right">{invoice.client?.name || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right">
                  {invoice.project?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Payment due</span>
                <span>
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Amount</span>
                <span className="tabular-nums font-medium">
                  {invoice.currency} {Number(invoice.amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Sent</span>
                <span>{invoice.sentAt ? formatDate(invoice.sentAt) : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { documentsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

type DocItem = {
  id: string;
  name: string;
  size?: number;
  createdAt?: string;
  projectId?: string;
  project?: { id: string; name: string };
};

function formatBytes(size?: number) {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SpaceDocsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", "space", projectId],
    queryFn: () => documentsApi.list({ projectId }),
    retry: false,
  });

  const items: DocItem[] = useMemo(() => {
    const payload = data?.data?.data ?? data?.data ?? {};
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    const docs = Array.isArray(payload.documents) ? payload.documents : [];
    return docs;
  }, [data]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentsApi.upload(file, { name: file.name, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Uploaded — also visible in global Docs");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Upload failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Moved to trash");
    },
  });

  const handleDownload = async (doc: DocItem) => {
    try {
      const res = await documentsApi.download(doc.id);
      const payload = res.data?.data ?? res.data;
      if (payload?.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("Download link unavailable");
    } catch {
      toast.error("Could not download");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Files in this space also appear in{" "}
          <Link href="/documents" className="text-[#0C66E4] hover:underline">
            global Docs
          </Link>
          .
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
            }}
          />
          <Button
            className="bg-[#0C66E4] hover:bg-[#0055CC]"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Upload a file to this space. It will also show in global Docs."
          actionLabel="Upload"
          onAction={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {doc.name}
                      <Badge variant="outline" className="text-[10px]">
                        Space
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(doc.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {doc.createdAt ? formatDate(doc.createdAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const ok = await confirm(
                            trashConfirm("document", doc.name),
                          );
                          if (ok) deleteMutation.mutate(doc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

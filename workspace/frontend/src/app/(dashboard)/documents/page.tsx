"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileSignature,
  FileText,
  Folder,
  Upload,
  Search,
  Grid,
  List,
  Download,
  MoreHorizontal,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { documentsApi } from "@/lib/api";
import { useAuthStore, hasRole } from "@/lib/auth-store";
import { formatDate, cn } from "@/lib/utils";
import { NdaDocumentPreview } from "@/components/features/NdaDocumentPreview";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

type DocItem = {
  id: string;
  kind?: "file" | "nda";
  name: string;
  type?: string;
  size?: number;
  folder?: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  signedAt?: string;
  contentPreview?: string;
  storageUrl?: string | null;
};

function formatBytes(size?: number) {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const isClient = hasRole(user, ["client"]);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("All");
  const [previewNda, setPreviewNda] = useState<DocItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list(),
    retry: false,
  });

  const items: DocItem[] = useMemo(() => {
    const payload = data?.data?.data ?? data?.data ?? {};
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    const docs = Array.isArray(payload.documents) ? payload.documents : [];
    const ndas = Array.isArray(payload.ndaDocuments) ? payload.ndaDocuments : [];
    return [...ndas, ...docs];
  }, [data]);

  const folders = useMemo(() => {
    const set = new Set<string>(["All"]);
    items.forEach((d) => {
      if (d.folder) set.add(d.folder);
      if (d.kind === "nda" || d.type === "NDA") set.add("NDA");
    });
    return Array.from(set);
  }, [items]);

  const filtered = items.filter((doc) => {
    const folder = doc.folder || (doc.kind === "nda" || doc.type === "NDA" ? "NDA" : "General");
    const matchesFolder = activeFolder === "All" || folder === activeFolder;
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file, { name: file.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded");
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
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not delete";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const handleDownload = async (doc: DocItem) => {
    const triggerBlobDownload = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const base64ToBlob = (base64: string, mimeType: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType || "application/octet-stream" });
    };

    try {
      const res = await documentsApi.download(doc.id);
      const payload = res.data?.data ?? res.data;

      if (payload?.kind === "inline" && payload.content) {
        triggerBlobDownload(
          new Blob([payload.content], { type: payload.mimeType || "text/plain" }),
          payload.name || `${doc.name}.txt`,
        );
        return;
      }

      if (payload?.kind === "base64" && payload.content) {
        triggerBlobDownload(
          base64ToBlob(payload.content, payload.mimeType || "application/octet-stream"),
          payload.name || doc.name,
        );
        return;
      }

      if (payload?.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }

      toast.error("Download link unavailable");
    } catch {
      toast.error("Could not download document");
    }
  };

  const openNda = async (doc: DocItem) => {
    try {
      const res = await documentsApi.get(doc.id);
      const payload = res.data?.data ?? res.data;
      setPreviewNda({
        ...doc,
        contentPreview: payload?.content || doc.contentPreview,
      });
    } catch {
      setPreviewNda(doc);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            {isClient
              ? "Your files and signed agreements"
              : "Browse and manage project files"}
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
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
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "grid")}>
          <TabsList>
            <TabsTrigger value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="grid" aria-label="Grid view">
              <Grid className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {folders.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {folders.map((folder) => (
            <Button
              key={folder}
              variant={activeFolder === folder ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFolder(folder)}
            >
              {folder !== "All" && <Folder className="h-3.5 w-3.5 mr-1" />}
              {folder}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description={
            isClient
              ? "Upload files here. Signed NDAs will appear automatically."
              : "Upload files to share with your team and clients."
          }
          actionLabel="Upload"
          onAction={() => fileInputRef.current?.click()}
        />
      ) : view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Folder</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => {
                  const isNda = doc.kind === "nda" || doc.type === "NDA";
                  const Icon = isNda ? FileSignature : FileText;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isNda ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isNda ? "Signed agreement" : formatBytes(doc.size)}
                            </p>
                          </div>
                          {isNda && (
                            <Badge variant="success" className="shrink-0">
                              Signed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {doc.folder || (isNda ? "NDA" : "General")}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(
                          doc.signedAt || doc.updatedAt || doc.createdAt || "",
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isNda && (
                              <DropdownMenuItem onClick={() => openNda(doc)}>
                                <Eye className="h-4 w-4 mr-2" /> View
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4 mr-2" /> Download
                            </DropdownMenuItem>
                            {!isNda && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async () => {
                                  const ok = await confirm(trashConfirm("document", doc.name));
                                  if (ok) deleteMutation.mutate(doc.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Move to trash
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const isNda = doc.kind === "nda" || doc.type === "NDA";
            const Icon = isNda ? FileSignature : FileText;
            return (
              <Card
                key={doc.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => (isNda ? openNda(doc) : handleDownload(doc))}
              >
                <CardContent className="p-4">
                  <Icon
                    className={cn(
                      "h-8 w-8 mb-3",
                      isNda ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <Badge variant={isNda ? "success" : "outline"} className="text-[10px]">
                      {isNda ? "Signed NDA" : formatBytes(doc.size)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(doc.signedAt || doc.updatedAt || doc.createdAt || "")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewNda} onOpenChange={(v) => !v && setPreviewNda(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewNda?.name || "Signed NDA"}</DialogTitle>
            <DialogDescription>Your signed agreement</DialogDescription>
          </DialogHeader>
          <NdaDocumentPreview content={previewNda?.contentPreview || ""} />
          <Button
            variant="outline"
            onClick={() => previewNda && handleDownload(previewNda)}
          >
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

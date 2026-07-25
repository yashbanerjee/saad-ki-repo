"use client";

import { useState } from "react";
import {
  FileText,
  Folder,
  Upload,
  Search,
  Grid,
  List,
  Download,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  folder: string;
  updatedAt: string;
}

const typeColors: Record<string, string> = {
  pdf: "text-red-500",
  doc: "text-blue-500",
  design: "text-purple-500",
  archive: "text-amber-500",
};

export default function DocumentsPage() {
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("All");
  const [isLoading] = useState(false);

  const documents: Document[] = [];
  const folders = ["All", ...Array.from(new Set(documents.map((d) => d.folder)))];

  const filtered = documents.filter(
    (doc) =>
      (activeFolder === "All" || doc.folder === activeFolder) &&
      doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">Browse and manage project files</p>
        </div>
        <Button><Upload className="h-4 w-4 mr-1" /> Upload</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")}><Grid className="h-4 w-4" /></Button>
        </div>
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
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Upload files to share with your team and clients."
          actionLabel="Upload"
        />
      ) : view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors">
                  <FileText className={cn("h-5 w-5 shrink-0", typeColors[doc.type] || "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.folder} · {doc.size}</p>
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(doc.updatedAt)}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Download className="h-4 w-4 mr-2" />Download</DropdownMenuItem>
                      <DropdownMenuItem>Rename</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <FileText className={cn("h-8 w-8 mb-3", typeColors[doc.type] || "text-muted-foreground")} />
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline" className="text-[10px]">{doc.size}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(doc.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

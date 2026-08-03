"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LayoutGrid, Plus, Target, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/components/crm/crm-constants";
import { leadsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Lead {
  id: string;
  title: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  organizationName?: string | null;
  type: string;
  status: string;
  source: string;
  onBoard?: boolean;
  estimatedValue?: string | number | null;
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "inbox", search],
    queryFn: () =>
      leadsApi.list({ limit: 100, onBoard: false, search: search || undefined }),
    retry: false,
  });

  const leads: Lead[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0;

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
        onBoard: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created — select it and move to Board when ready");
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
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create lead";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const moveMutation = useMutation({
    mutationFn: (ids: string[]) => leadsApi.moveToBoard(ids),
    onSuccess: (res) => {
      const updated = res?.data?.updated ?? selected.size;
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${updated} lead(s) moved to Board`);
      setSelected(new Set());
    },
    onError: () => toast.error("Could not move leads to board"),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => leadsApi.import(file),
    onSuccess: (res) => {
      const result = res?.data?.data ?? res?.data ?? {};
      const created = result.created ?? 0;
      const skipped = result.skipped ?? 0;
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Imported ${created} lead(s)${skipped ? `, skipped ${skipped}` : ""}`);
      setImportOpen(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Import failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(leads.map((l) => l.id)));
    else setSelected(new Set());
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground text-sm">
            Inbox leads — import or create, then move selected ones to the Board
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/leads/board">
              <LayoutGrid className="h-4 w-4 mr-1" /> Open Board
            </Link>
          </Button>
          <Button
            variant="secondary"
            disabled={!someSelected || moveMutation.isPending}
            onClick={() => moveMutation.mutate([...selected])}
          >
            Move to board{someSelected ? ` (${selected.size})` : ""}
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-1" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import leads from Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Upload <code>.xlsx</code> or <code>.csv</code>. Columns: title, name, email,
                  phone, organization, source, estimatedValue, notes. Email and phone are
                  optional — rows with only one (or neither) still import.
                </p>
                <a
                  href="/templates/leads-import-sample.csv"
                  download
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Download sample CSV
                </a>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!importFile || importMutation.isPending}
                  onClick={() => importFile && importMutation.mutate(importFile)}
                >
                  {importMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Lead</DialogTitle>
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
                  {createMutation.isPending ? "Saving..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Input
        placeholder="Search leads..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="Import from Excel or create a lead, then move selected leads to the Board."
          actionLabel="New Lead"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b px-4 py-2.5 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => toggleAll(v === true)}
                aria-label="Select all leads"
              />
              <span>
                {someSelected ? `${selected.size} selected` : `${leads.length} leads`}
              </span>
            </div>
            <div className="divide-y">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(lead.id)}
                    onCheckedChange={(v) => toggleOne(lead.id, v === true)}
                    aria-label={`Select ${lead.title}`}
                  />
                  <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
                    <p className="font-medium truncate">{lead.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.name}
                      {lead.email ? ` · ${lead.email}` : ""}
                      {lead.organizationName ? ` · ${lead.organizationName}` : ""}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        LEAD_STATUSES.find((s) => s.key === lead.status)?.color,
                        "bg-opacity-15",
                      )}
                    >
                      {lead.status}
                    </Badge>
                    {lead.estimatedValue != null && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        ${Number(lead.estimatedValue).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

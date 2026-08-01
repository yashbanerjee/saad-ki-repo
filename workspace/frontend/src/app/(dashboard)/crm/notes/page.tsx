"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { crmNotesApi } from "@/lib/api";
import { toast } from "sonner";

export default function CrmNotesPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["crm-notes"],
    queryFn: () => crmNotesApi.list({ limit: 100 }),
    retry: false,
  });

  const notes = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const createMutation = useMutation({
    mutationFn: () => crmNotesApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
      toast.success("Note saved");
      setOpen(false);
      setForm({ title: "", body: "" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Notes</h1>
          <p className="text-muted-foreground text-sm">Shared notes across the CRM</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Note</DialogTitle>
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
                <Label>Body</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!form.body || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes"
          description="Capture context for your pipeline."
          actionLabel="New Note"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n: { id: string; title?: string; body: string; createdAt: string }) => (
            <Card key={n.id}>
              <CardContent className="p-4 space-y-2">
                {n.title && <p className="font-medium">{n.title}</p>}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {n.body}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

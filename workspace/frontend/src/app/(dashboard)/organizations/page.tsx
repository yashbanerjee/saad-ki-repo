"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { organizationsApi } from "@/lib/api";
import { toast } from "sonner";

export default function OrganizationsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", website: "", industry: "", email: "" });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["organizations", search],
    queryFn: () => organizationsApi.list({ limit: 100, search: search || undefined }),
    retry: false,
  });

  const orgs = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const createMutation = useMutation({
    mutationFn: () => organizationsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organization created");
      setOpen(false);
      setForm({ name: "", website: "", industry: "", email: "" });
    },
    onError: () => toast.error("Failed to create organization"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
          <h1 className="font-display text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground text-sm">Accounts linked to contacts, leads, and deals</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search organizations…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations"
          description="Create accounts to group contacts and deals."
          actionLabel="New Organization"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {orgs.map(
              (o: {
                id: string;
                name: string;
                website?: string;
                industry?: string;
                _count?: { contacts?: number; deals?: number };
              }) => (
                <Link
                  key={o.id}
                  href={`/organizations/${o.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[o.industry, o.website].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o._count?.contacts ?? 0} contacts · {o._count?.deals ?? 0} deals
                  </p>
                </Link>
              ),
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

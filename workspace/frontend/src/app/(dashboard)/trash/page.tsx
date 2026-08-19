"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { trashApi } from "@/lib/api";
import { hasRole, useAuthStore } from "@/lib/auth-store";
import { formatRelativeTime } from "@/lib/utils";
import { useConfirm } from "@/providers/confirm-provider";
import { toast } from "sonner";

type TrashItem = {
  id: string;
  title: string;
  entityType: string;
  typeLabel?: string;
  deletedAt: string;
  deletedBy?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
};

export default function TrashPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const canPurge = hasRole(user, ["admin", "manager"]);

  const { data, isLoading } = useQuery({
    queryKey: ["trash"],
    queryFn: () => trashApi.list(),
    retry: false,
  });

  const items: TrashItem[] = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const restoreMutation = useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast.success("Restored");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not restore");
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (id: string) => trashApi.purge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast.success("Permanently deleted");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not delete permanently");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted items stay here until an admin permanently removes them.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="When you delete a project, task, or document, it will show up here so you can restore it."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const deletedBy = item.deletedBy
                    ? `${item.deletedBy.firstName || ""} ${item.deletedBy.lastName || ""}`.trim() ||
                      item.deletedBy.email
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.title}</p>
                        {deletedBy ? (
                          <p className="text-xs text-muted-foreground">by {deletedBy}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary">{item.typeLabel || item.entityType}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatRelativeTime(item.deletedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate(item.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                          {canPurge ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={purgeMutation.isPending}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Permanently delete?",
                                  description: `"${item.title}" will be removed forever. This cannot be undone.`,
                                  confirmLabel: "Delete forever",
                                  destructive: true,
                                });
                                if (ok) purgeMutation.mutate(item.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete forever
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

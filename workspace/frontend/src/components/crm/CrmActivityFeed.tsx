"use client";

import { Badge } from "@/components/ui/badge";

export type CrmActivityItem = {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  createdBy?: { firstName?: string; lastName?: string } | null;
};

export function CrmActivityFeed({ items }: { items: CrmActivityItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="relative pl-4 border-l-2 border-border/70">
          <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary/70" />
          <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">
                {a.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{a.body}</p>
            {a.createdBy && (
              <p className="text-xs text-muted-foreground mt-1">
                {[a.createdBy.firstName, a.createdBy.lastName].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

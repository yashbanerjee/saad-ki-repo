"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CrmKanbanColumn = {
  key: string;
  label: string;
  color?: string;
  footer?: string;
};

export type CrmKanbanCard = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  /** Extra deal-focused line (e.g. close date / probability) */
  detail?: string;
  badge?: string;
  href: string;
  status: string;
  counts?: { emails?: number; notes?: number; tasks?: number; comments?: number };
};

type Props = {
  columns: CrmKanbanColumn[];
  items: CrmKanbanCard[];
  onMove: (id: string, status: string) => void;
};

export function CrmKanbanBoard({ columns, items, onMove }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <div className="grid gap-3 auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto pb-2 md:grid-flow-row md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {columns.map((col) => {
        const colItems = items.filter((i) => i.status === col.key);
        return (
          <div
            key={col.key}
            className="rounded-xl border bg-muted/25 p-2 min-h-[300px] flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingId) onMove(draggingId, col.key);
              setDraggingId(null);
            }}
          >
            <div className="flex items-center justify-between px-2 py-2 mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    col.color || "bg-muted-foreground",
                  )}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {colItems.length}
              </Badge>
            </div>
            <div className="space-y-2 flex-1">
              {colItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={(e) => draggingId && e.preventDefault()}
                >
                  <Card
                    draggable
                    onDragStart={() => setDraggingId(item.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      "cursor-grab active:cursor-grabbing border-border/70 shadow-sm hover:shadow-md transition-all mb-2",
                      draggingId === item.id && "opacity-50 scale-[0.98]",
                    )}
                  >
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium leading-snug">
                          {item.title}
                        </CardTitle>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] font-normal"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-1 space-y-1.5 text-xs text-muted-foreground">
                      {item.subtitle && (
                        <p className="truncate">{item.subtitle}</p>
                      )}
                      {item.meta && (
                        <p className="font-semibold text-foreground tabular-nums">
                          {item.meta}
                        </p>
                      )}
                      {item.detail && (
                        <p className="text-[11px] text-muted-foreground">
                          {item.detail}
                        </p>
                      )}
                      {item.counts && (
                        <p className="text-[10px] text-muted-foreground/80 pt-1">
                          {[
                            item.counts.emails != null
                              ? `${item.counts.emails} email`
                              : null,
                            item.counts.notes != null
                              ? `${item.counts.notes} note`
                              : null,
                            item.counts.tasks != null
                              ? `${item.counts.tasks} task`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {col.footer && (
              <div className="mt-2 border-t px-2 pt-2 text-[11px] font-medium tabular-nums text-muted-foreground">
                {col.footer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { crmTasksApi, issuesApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

type CalItem = {
  id: string;
  title: string;
  due: Date;
  kind: "crm" | "issue";
  href: string;
  meta?: string;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonthGrid(cursor: Date) {
  const first = startOfMonth(cursor);
  const startWeekday = first.getDay(); // 0 Sun
  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= count; d++) {
    days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const { data: crmData, isLoading: crmLoading } = useQuery({
    queryKey: ["crm-tasks", "calendar"],
    queryFn: () => crmTasksApi.list({ limit: 100 }),
    retry: false,
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["issues", "calendar"],
    queryFn: () => issuesApi.list({ limit: 100 }),
    retry: false,
  });

  const items: CalItem[] = useMemo(() => {
    const out: CalItem[] = [];
    const crmRaw = crmData?.data?.data ?? crmData?.data ?? [];
    const crmList = Array.isArray(crmRaw) ? crmRaw : Array.isArray(crmRaw?.data) ? crmRaw.data : [];
    for (const t of crmList as Array<{
      id: string;
      title: string;
      dueDate?: string | null;
      status?: string;
    }>) {
      if (!t.dueDate) continue;
      if (t.status === "DONE" || t.status === "CANCELLED") continue;
      out.push({
        id: `crm-${t.id}`,
        title: t.title,
        due: new Date(t.dueDate),
        kind: "crm",
        href: "/crm/tasks",
        meta: "CRM task",
      });
    }

    const issueRaw = issuesData?.data?.data ?? issuesData?.data ?? [];
    const issueList = Array.isArray(issueRaw)
      ? issueRaw
      : Array.isArray(issueRaw?.data)
        ? issueRaw.data
        : [];
    for (const issue of issueList as Array<{
      id: string;
      title: string;
      key?: string;
      dueDate?: string | null;
      status?: string;
    }>) {
      if (!issue.dueDate) continue;
      if (issue.status === "DONE" || issue.status === "CANCELLED") continue;
      out.push({
        id: `issue-${issue.id}`,
        title: issue.key ? `${issue.key}: ${issue.title}` : issue.title,
        due: new Date(issue.dueDate),
        kind: "issue",
        href: `/issues/${issue.id}`,
        meta: "Issue",
      });
    }

    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [crmData, issuesData]);

  const grid = daysInMonthGrid(cursor);
  const selectedItems = items.filter((i) => sameDay(i.due, selected));
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const isLoading = crmLoading || issuesLoading;
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Workspace
          </p>
          <h1 className="font-display text-2xl font-bold">Global calendar</h1>
          <p className="text-sm text-muted-foreground">
            CRM task deadlines and issue due dates across your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const now = startOfMonth(new Date());
              setCursor(now);
              setSelected(new Date());
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">{monthLabel}</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {grid.map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`} className="h-16" />;
                  const dayItems = items.filter((i) => sameDay(i.due, day));
                  const isSelected = sameDay(day, selected);
                  const isToday = sameDay(day, today);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelected(day)}
                      className={cn(
                        "flex h-16 flex-col rounded-lg border p-1.5 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:bg-muted/60",
                        isToday && !isSelected && "border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isToday && "text-primary",
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <div className="mt-auto flex flex-wrap gap-0.5">
                        {dayItems.slice(0, 3).map((i) => (
                          <span
                            key={i.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              i.kind === "crm" ? "bg-orange-500" : "bg-sky-500",
                            )}
                          />
                        ))}
                        {dayItems.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{dayItems.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> CRM tasks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Issues
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {formatDate(selected)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedItems.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing due"
                description="No open CRM tasks or issues due on this day."
              />
            ) : (
              selectedItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-3 transition hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.kind === "crm"
                        ? "bg-orange-500/15 text-orange-600"
                        : "bg-sky-500/15 text-sky-600",
                    )}
                  >
                    {item.kind === "crm" ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Bug className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {item.meta}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {item.due.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

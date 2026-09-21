"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Bug,
  CheckSquare,
  Receipt,
  Handshake,
  Flag,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  crmTasksApi,
  issuesApi,
  invoicesApi,
  dealsApi,
  projectsApi,
} from "@/lib/api";
import {
  CALENDAR_KIND_STYLE,
  type CalendarEvent,
  type CalendarKind,
  unwrapList,
} from "@/lib/calendar-events";
import { cn, formatDate } from "@/lib/utils";
import { spaceHref } from "@/lib/space-paths";

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
  const startWeekday = first.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= count; d++) {
    days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function parseDue(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const KIND_ICON: Record<CalendarKind, typeof Bug> = {
  issue: Bug,
  crm: CheckSquare,
  invoice: Receipt,
  deal: Handshake,
  milestone: Flag,
  space: FolderKanban,
  sprint: Flag,
};

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const { data: crmData, isLoading: crmLoading } = useQuery({
    queryKey: ["calendar", "crm-tasks"],
    queryFn: () => crmTasksApi.list({ limit: 200 }),
    retry: false,
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["calendar", "issues"],
    queryFn: () => issuesApi.list({ limit: 200 }),
    retry: false,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["calendar", "invoices"],
    queryFn: () => invoicesApi.list({ limit: 200 }),
    retry: false,
  });

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ["calendar", "deals"],
    queryFn: () => dealsApi.list({ limit: 200 }),
    retry: false,
  });

  const { data: spacesData, isLoading: spacesLoading } = useQuery({
    queryKey: ["calendar", "spaces"],
    queryFn: () => projectsApi.list({ limit: 100 }),
    retry: false,
  });

  const spaces = useMemo(() => {
    return unwrapList(spacesData) as Array<{
      id: string;
      name: string;
      startDate?: string | null;
      endDate?: string | null;
      createdAt?: string | null;
    }>;
  }, [spacesData]);

  const { data: milestonesData, isLoading: milestonesLoading } = useQuery({
    queryKey: ["calendar", "milestones", spaces.map((s) => s.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        spaces.slice(0, 30).map(async (s) => {
          try {
            const res = await projectsApi.listMilestones(s.id);
            const list = unwrapList(res) as Array<{
              id: string;
              name: string;
              dueDate?: string | null;
              status?: string;
            }>;
            return list.map((m) => ({ ...m, projectId: s.id, projectName: s.name }));
          } catch {
            return [];
          }
        }),
      );
      return results.flat();
    },
    enabled: spaces.length > 0,
    retry: false,
  });

  const items: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];

    for (const t of unwrapList(crmData) as Array<{
      id: string;
      title: string;
      dueDate?: string | null;
      status?: string;
    }>) {
      const due = parseDue(t.dueDate);
      if (!due) continue;
      if (t.status === "DONE" || t.status === "CANCELLED") continue;
      out.push({
        id: `crm-${t.id}`,
        title: t.title,
        due,
        kind: "crm",
        href: "/crm/tasks",
        meta: "CRM task",
      });
    }

    for (const issue of unwrapList(issuesData) as Array<{
      id: string;
      title: string;
      key?: string;
      dueDate?: string | null;
      createdAt?: string | null;
      status?: string;
      project?: { id?: string; name?: string } | null;
      projectId?: string;
    }>) {
      if (issue.status === "CANCELLED") continue;
      const spaceName = issue.project?.name;
      const spaceId = issue.project?.id || issue.projectId;
      const label = issue.key ? `${issue.key}: ${issue.title}` : issue.title;
      const href = `/issues/${issue.id}`;

      const created = parseDue(issue.createdAt);
      if (created) {
        out.push({
          id: `issue-created-${issue.id}`,
          title: label,
          due: created,
          kind: "issue",
          href,
          meta: spaceName ? `Task created · ${spaceName}` : "Task created",
          spaceId,
        });
      }

      if (issue.status === "DONE") continue;
      const due = parseDue(issue.dueDate);
      if (due) {
        out.push({
          id: `issue-due-${issue.id}`,
          title: label,
          due,
          kind: "issue",
          href,
          meta: spaceName ? `Due · ${spaceName}` : "Due",
          spaceId,
        });
      }
    }

    for (const inv of unwrapList(invoicesData) as Array<{
      id: string;
      number?: string;
      invoiceNumber?: string;
      dueDate?: string | null;
      status?: string;
      client?: { name?: string } | null;
    }>) {
      const due = parseDue(inv.dueDate);
      if (!due) continue;
      if (inv.status === "PAID" || inv.status === "CANCELLED") continue;
      out.push({
        id: `invoice-${inv.id}`,
        title: `Invoice ${inv.number || inv.invoiceNumber || inv.id.slice(0, 6)}`,
        due,
        kind: "invoice",
        href: `/invoices/${inv.id}`,
        meta: inv.client?.name ? `Invoice · ${inv.client.name}` : "Invoice due",
      });
    }

    for (const deal of unwrapList(dealsData) as Array<{
      id: string;
      name?: string;
      title?: string;
      expectedCloseDate?: string | null;
      stage?: string;
      status?: string;
    }>) {
      const due = parseDue(deal.expectedCloseDate);
      if (!due) continue;
      if (deal.stage === "CLOSED_LOST" || deal.status === "LOST") continue;
      out.push({
        id: `deal-${deal.id}`,
        title: deal.name || deal.title || "Deal",
        due,
        kind: "deal",
        href: `/deals/${deal.id}`,
        meta: "Expected close",
      });
    }

    for (const space of spaces) {
      const created = parseDue(space.createdAt);
      if (created) {
        out.push({
          id: `space-created-${space.id}`,
          title: space.name,
          due: created,
          kind: "space",
          href: spaceHref(space.id),
          meta: "Space created",
          spaceId: space.id,
        });
      }
      const end = parseDue(space.endDate);
      if (end) {
        out.push({
          id: `space-end-${space.id}`,
          title: space.name,
          due: end,
          kind: "space",
          href: spaceHref(space.id),
          meta: "Space target end",
          spaceId: space.id,
        });
      }
      const start = parseDue(space.startDate);
      if (start) {
        out.push({
          id: `space-start-${space.id}`,
          title: space.name,
          due: start,
          kind: "space",
          href: spaceHref(space.id),
          meta: "Space start",
          spaceId: space.id,
        });
      }
    }

    for (const m of (milestonesData || []) as Array<{
      id: string;
      name: string;
      dueDate?: string | null;
      status?: string;
      projectId: string;
      projectName: string;
    }>) {
      const due = parseDue(m.dueDate);
      if (!due) continue;
      if (m.status === "COMPLETED" || m.status === "CANCELLED") continue;
      out.push({
        id: `ms-${m.id}`,
        title: m.name,
        due,
        kind: "milestone",
        href: spaceHref(m.projectId, "board"),
        meta: `Milestone · ${m.projectName}`,
        spaceId: m.projectId,
      });
    }

    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [crmData, issuesData, invoicesData, dealsData, spaces, milestonesData]);

  const grid = daysInMonthGrid(cursor);
  const selectedItems = items.filter((i) => sameDay(i.due, selected));
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const isLoading =
    crmLoading ||
    issuesLoading ||
    invoicesLoading ||
    dealsLoading ||
    spacesLoading ||
    milestonesLoading;
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
            Space created dates, every task created, task due times, CRM, invoices, deals, and milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCursor(startOfMonth(new Date()));
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

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(CALENDAR_KIND_STYLE) as CalendarKind[])
          .filter((k) => k !== "sprint")
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", CALENDAR_KIND_STYLE[k].dot)} />
              {CALENDAR_KIND_STYLE[k].label}
            </span>
          ))}
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
                        className={cn("text-xs font-medium", isToday && "text-primary")}
                      >
                        {day.getDate()}
                      </span>
                      <div className="mt-auto flex flex-wrap gap-0.5">
                        {dayItems.slice(0, 4).map((i) => (
                          <span
                            key={i.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              CALENDAR_KIND_STYLE[i.kind].dot,
                            )}
                          />
                        ))}
                        {dayItems.length > 4 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{dayItems.length - 4}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
                title="Nothing scheduled"
                description="No dated items on this day. Create work with a due date & time to track it here."
              />
            ) : (
              selectedItems.map((item) => {
                const Icon = KIND_ICON[item.kind];
                const style = CALENDAR_KIND_STYLE[item.kind];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-3 transition hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        style.badge,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.meta || style.label}
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
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

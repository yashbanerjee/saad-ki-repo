"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bug,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { issuesApi, projectsApi } from "@/lib/api";
import {
  CALENDAR_KIND_STYLE,
  type CalendarEvent,
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

export default function SpaceCalendarPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["calendar", "space-issues", projectId],
    queryFn: () => issuesApi.list({ projectId, limit: 200 }),
    retry: false,
  });

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ["space", projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: milestonesData, isLoading: msLoading } = useQuery({
    queryKey: ["calendar", "space-milestones", projectId],
    queryFn: () => projectsApi.listMilestones(projectId),
    retry: false,
  });

  const space = projectData?.data?.data ?? projectData?.data;

  const items: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];

    for (const issue of unwrapList(issuesData) as Array<{
      id: string;
      title: string;
      key?: string;
      dueDate?: string | null;
      createdAt?: string | null;
      status?: string;
    }>) {
      if (issue.status === "CANCELLED") continue;
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
          meta: "Task created",
          spaceId: projectId,
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
          meta: "Due",
          spaceId: projectId,
        });
      }
    }

    for (const m of unwrapList(milestonesData) as Array<{
      id: string;
      name: string;
      dueDate?: string | null;
      status?: string;
    }>) {
      const due = parseDue(m.dueDate);
      if (!due) continue;
      if (m.status === "COMPLETED" || m.status === "CANCELLED") continue;
      out.push({
        id: `ms-${m.id}`,
        title: m.name,
        due,
        kind: "milestone",
        href: spaceHref(projectId, "board"),
        meta: "Milestone",
        spaceId: projectId,
      });
    }

    if (space) {
      const created = parseDue(space.createdAt);
      if (created) {
        out.push({
          id: `space-created-${projectId}`,
          title: space.name || "Space created",
          due: created,
          kind: "space",
          href: spaceHref(projectId),
          meta: "Space created",
          spaceId: projectId,
        });
      }
      const end = parseDue(space.endDate);
      if (end) {
        out.push({
          id: `space-end-${projectId}`,
          title: space.name || "Space end",
          due: end,
          kind: "space",
          href: spaceHref(projectId),
          meta: "Target end",
          spaceId: projectId,
        });
      }
      const start = parseDue(space.startDate);
      if (start) {
        out.push({
          id: `space-start-${projectId}`,
          title: space.name || "Space start",
          due: start,
          kind: "space",
          href: spaceHref(projectId),
          meta: "Start",
          spaceId: projectId,
        });
      }
    }

    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [issuesData, milestonesData, space, projectId]);

  const grid = daysInMonthGrid(cursor);
  const selectedItems = items.filter((i) => sameDay(i.due, selected));
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const isLoading = issuesLoading || projectLoading || msLoading;
  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Dates in this space also appear in the{" "}
          <Link href="/calendar" className="text-[#0C66E4] hover:underline">
            global calendar
          </Link>
          : space created, each task created, and each task due date & time.
        </p>
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
                        {dayItems.slice(0, 3).map((i) => (
                          <span
                            key={i.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              CALENDAR_KIND_STYLE[i.kind].dot,
                            )}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Work items
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Milestones
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" /> Space dates
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
                description="No dated work items or milestones on this day."
              />
            ) : (
              selectedItems.map((item) => {
                const Icon =
                  item.kind === "milestone"
                    ? Flag
                    : item.kind === "space"
                      ? FolderKanban
                      : Bug;
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
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

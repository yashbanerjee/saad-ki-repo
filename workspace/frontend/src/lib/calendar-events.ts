/** Helpers for datetime-local inputs and unified calendar events. */

export function toDatetimeLocalValue(d?: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert datetime-local value to ISO string for APIs. */
export function fromDatetimeLocalValue(value: string): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function defaultDueDatetimeLocal(hoursAhead = 24): string {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  return toDatetimeLocalValue(d);
}

export type CalendarKind =
  | "issue"
  | "crm"
  | "invoice"
  | "deal"
  | "milestone"
  | "space"
  | "sprint";

export type CalendarEvent = {
  id: string;
  title: string;
  due: Date;
  kind: CalendarKind;
  href: string;
  meta?: string;
  spaceId?: string;
};

export const CALENDAR_KIND_STYLE: Record<
  CalendarKind,
  { dot: string; badge: string; label: string }
> = {
  issue: {
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    label: "Work item",
  },
  crm: {
    dot: "bg-orange-500",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    label: "CRM task",
  },
  invoice: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    label: "Invoice",
  },
  deal: {
    dot: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    label: "Deal",
  },
  milestone: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    label: "Milestone",
  },
  space: {
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    label: "Space",
  },
  sprint: {
    dot: "bg-rose-500",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    label: "Sprint",
  },
};

export function unwrapList(data: unknown): unknown[] {
  const payload =
    (data as { data?: { data?: unknown } })?.data?.data ??
    (data as { data?: unknown })?.data ??
    data;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

/** Deep-link from notification payload data. */
export function notificationHref(
  data?: Record<string, unknown> | null,
): string | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.href === "string" && data.href.startsWith("/")) return data.href;
  if (typeof data.issueId === "string") return `/issues/${data.issueId}`;
  if (typeof data.leadId === "string") return `/leads/${data.leadId}`;
  if (typeof data.dealId === "string") return `/deals/${data.dealId}`;
  if (typeof data.crmTaskId === "string") return "/crm/tasks";
  if (typeof data.projectId === "string") return `/projects/${data.projectId}`;
  if (typeof data.clientId === "string") return `/clients/${data.clientId}`;
  return null;
}

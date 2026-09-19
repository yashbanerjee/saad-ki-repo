import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  CalendarDays,
  Files,
  Users,
  Target,
  LayoutGrid,
  Handshake,
  Contact,
  Building2,
  CheckSquare,
  StickyNote,
  BarChart3,
  ClipboardList,
  Activity,
  Receipt,
  FolderKanban,
} from "lucide-react";

export type WorkspaceAppRole = "admin" | "manager" | "member" | "client";

export interface WorkspaceApp {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile background + icon color */
  tone: string;
  roles?: WorkspaceAppRole[];
}

/**
 * Google-style Workspace launcher apps for TaskFlow.
 * CRM lives here (not in the sidebar), plus Calendar, Docs, Team, and related tools.
 */
export const workspaceApps: WorkspaceApp[] = [
  {
    id: "crm",
    title: "CRM",
    description: "Pipeline home",
    href: "/crm",
    icon: Sparkles,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "Deadlines & due dates",
    href: "/calendar",
    icon: CalendarDays,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "docs",
    title: "Docs",
    description: "Files & NDA docs",
    href: "/documents",
    icon: Files,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "team",
    title: "Team",
    description: "People & roles",
    href: "/team",
    icon: Users,
    tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
    roles: ["admin", "manager"],
  },
  {
    id: "leads",
    title: "Leads",
    description: "Inbox leads",
    href: "/leads",
    icon: Target,
    tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "board",
    title: "Board",
    description: "Lead pipeline",
    href: "/leads/board",
    icon: LayoutGrid,
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "deals",
    title: "Deals",
    description: "Opportunities",
    href: "/deals",
    icon: Handshake,
    tone: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "contacts",
    title: "Contacts",
    description: "People records",
    href: "/contacts",
    icon: Contact,
    tone: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "organizations",
    title: "Orgs",
    description: "Companies",
    href: "/organizations",
    icon: Building2,
    tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "crm-tasks",
    title: "Tasks",
    description: "CRM tasks",
    href: "/crm/tasks",
    icon: CheckSquare,
    tone: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "notes",
    title: "Notes",
    description: "CRM notes",
    href: "/crm/notes",
    icon: StickyNote,
    tone: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "reports",
    title: "Reports",
    description: "CRM analytics",
    href: "/reports",
    icon: BarChart3,
    tone: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
    roles: ["admin", "manager"],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    description: "Forms & setup",
    href: "/onboarding",
    icon: ClipboardList,
    tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "activity",
    title: "Activity",
    description: "Workspace feed",
    href: "/activity",
    icon: Activity,
    tone: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "projects",
    title: "Spaces",
    description: "Delivery spaces",
    href: "/spaces",
    icon: FolderKanban,
    tone: "bg-primary/10 text-foreground",
    roles: ["admin", "manager", "member"],
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "Billing",
    href: "/invoices",
    icon: Receipt,
    tone: "bg-green-500/15 text-green-700 dark:text-green-300",
    roles: ["admin", "manager", "member"],
  },
];

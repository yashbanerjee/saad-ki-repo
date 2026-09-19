"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Spaces",
  spaces: "Spaces",
  issues: "Issues",
  clients: "Clients",
  leads: "Leads",
  crm: "CRM",
  deals: "Deals",
  contacts: "Contacts",
  organizations: "Organizations",
  onboarding: "Onboarding",
  nda: "NDA",
  documents: "Documents",
  calendar: "Calendar",
  list: "List",
  docs: "Docs",
  timeline: "Timeline",
  attachments: "Attachments",
  invoices: "Invoices",
  trash: "Trash",
  team: "Team",
  reports: "Reports",
  board: "Board",
  summary: "Summary",
  admin: "Admin",
  "client-portal": "Dashboard",
  notifications: "Notifications",
  settings: "Settings",
  search: "Search",
  backlog: "Backlog",
  sprints: "Sprints",
  "client-progress": "Client Progress",
  portal: "Client Dashboard",
  builder: "Form Builder",
  public: "Public Form",
};

const linkClass = "transition-colors hover:text-foreground";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const homeHref = isClientUser(user) ? "/client-portal" : "/dashboard";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link href={homeHref} className={cn(linkClass)}>
            Home
          </Link>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const label =
            routeLabels[segment] ||
            segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <span key={href} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <Link href={href} className={cn(linkClass)}>
                    {label}
                  </Link>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

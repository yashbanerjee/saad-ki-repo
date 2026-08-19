"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Bug,
  Users,
  Shield,
  BarChart3,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Globe,
  Plus,
  ChevronsUpDown,
  Search,
  Target,
  LayoutGrid,
  Handshake,
  Contact,
  CheckSquare,
  StickyNote,
  Receipt,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VedhaMark } from "@/components/brand/VedhaMark";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, hasRole, isClientUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ("admin" | "manager" | "member" | "client")[];
}

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  // Issues list is client-facing; staff use project boards instead
  { title: "Issues", href: "/issues", icon: Bug, roles: ["client"] },
  { title: "Invoices", href: "/invoices", icon: Receipt, roles: ["admin", "manager", "member", "client"] },
  { title: "Clients", href: "/clients", icon: Users, roles: ["admin", "manager", "member"] },
  { title: "Team", href: "/team", icon: Users, roles: ["admin", "manager"] },
];

const crmNav: NavItem[] = [
  { title: "CRM Home", href: "/crm", icon: Sparkles, roles: ["admin", "manager", "member"] },
  { title: "Leads", href: "/leads", icon: Target, roles: ["admin", "manager", "member"] },
  { title: "Board", href: "/leads/board", icon: LayoutGrid, roles: ["admin", "manager", "member"] },
  { title: "Deals", href: "/deals", icon: Handshake, roles: ["admin", "manager", "member"] },
  { title: "Contacts", href: "/contacts", icon: Contact, roles: ["admin", "manager", "member"] },
  { title: "Organizations", href: "/organizations", icon: Building2, roles: ["admin", "manager", "member"] },
  { title: "Tasks", href: "/crm/tasks", icon: CheckSquare, roles: ["admin", "manager", "member"] },
  { title: "Notes", href: "/crm/notes", icon: StickyNote, roles: ["admin", "manager", "member"] },
  { title: "Reports", href: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
];

const secondaryNav: NavItem[] = [
  // Staff-only shortcut; clients use Dashboard → /client-portal
  { title: "Client Portal", href: "/client-portal", icon: Globe, roles: ["admin"] },
  { title: "Admin", href: "/admin", icon: Shield, roles: ["admin"] },
  { title: "Trash", href: "/trash", icon: Trash2 },
  { title: "Settings", href: "/settings", icon: Settings },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  // Prefer exact / longer CRM paths so /leads does not steal /leads/board
  const isActive =
    item.href === "/leads"
      ? pathname === "/leads" ||
        (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/board"))
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function AppSidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const user = useAuthStore((s) => s.user);
  const workspace = user?.companyName ?? "Workspace";
  const isClient = isClientUser(user);
  const homeHref = isClient ? "/client-portal" : "/dashboard";

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || hasRole(user, item.roles));

  const visibleMain = filterByRole(
    mainNav.map((item) =>
      item.href === "/dashboard" ? { ...item, href: homeHref } : item,
    ),
  ).filter((item) => {
    // Clients: focused nav + Issues for board/task access
    if (!isClient) return true;
    return ["Dashboard", "Projects", "Issues", "Invoices"].includes(item.title);
  });

  // Clients must never see CRM or Client Portal
  const visibleCrm = isClient ? [] : filterByRole(crmNav);
  const visibleSecondary = filterByRole(secondaryNav).filter((item) => {
    if (!isClient) return true;
    return ["Trash", "Settings"].includes(item.title);
  });

  return (
    <TooltipProvider>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 272 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="chrome-sidebar hidden md:flex flex-col h-full shrink-0"
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border px-4 dark:border-white/[0.06]",
            collapsed && "justify-center px-2"
          )}
        >
          <Link href={homeHref} className="flex items-center gap-2.5">
            <VedhaMark className="h-9 w-9" />
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="overflow-hidden"
                >
                  <p className="text-base font-bold tracking-tight">TaskFlow</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    by Vedha
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <div className={cn("px-3 pt-4 space-y-2", collapsed && "px-2")}>
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Workspace
                    </p>
                    <p className="truncate font-medium">{workspace}</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuItem disabled>{workspace}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isClient && (
            <Button
              className={cn("w-full justify-start gap-2", collapsed && "px-0 justify-center")}
              size={collapsed ? "icon" : "default"}
              asChild
            >
              <Link href="/projects">
                <Plus className="h-4 w-4" />
                {!collapsed && "Quick create"}
              </Link>
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Navigate
              </p>
            )}
            {visibleMain.map((item) => (
              <NavLink key={`${item.href}-${item.title}`} item={item} collapsed={collapsed} />
            ))}
          </nav>

          {visibleCrm.length > 0 && (
            <>
              <Separator className="my-4 mx-3 bg-border dark:bg-white/[0.06]" />
              <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    CRM
                  </p>
                )}
                {visibleCrm.map((item) => (
                  <NavLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </nav>
            </>
          )}

          {visibleSecondary.length > 0 && (
            <>
              <Separator className="my-4 mx-3 bg-border dark:bg-white/[0.06]" />
              <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
                {visibleSecondary.map((item) => (
                  <NavLink key={`${item.href}-${item.title}`} item={item} collapsed={collapsed} />
                ))}
              </nav>
            </>
          )}
        </ScrollArea>

        <div className="border-t border-border p-3 space-y-2 dark:border-white/[0.06]">
          {!collapsed && (
            <Link
              href="/search"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Search className="h-4 w-4" />
              Search workspace
            </Link>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={toggle}
            className={cn("w-full text-muted-foreground", collapsed && "h-10 w-10")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" /> Collapse
              </>
            )}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

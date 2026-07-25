"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Bug,
  Users,
  FileText,
  ClipboardList,
  Shield,
  BarChart3,
  Settings,
  Building2,
  Bell,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileSignature,
  Globe,
  Plus,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, hasRole } from "@/lib/auth-store";
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
  { title: "Issues", href: "/issues", icon: Bug },
  { title: "Clients", href: "/clients", icon: Building2, roles: ["admin", "manager", "member"] },
  { title: "Onboarding", href: "/onboarding", icon: ClipboardList, roles: ["admin", "manager"] },
  { title: "NDA", href: "/nda", icon: FileSignature, roles: ["admin", "manager"] },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Team", href: "/team", icon: Users, roles: ["admin", "manager"] },
  { title: "Reports", href: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
];

const secondaryNav: NavItem[] = [
  { title: "Client Portal", href: "/client-portal", icon: Globe, roles: ["client", "admin"] },
  { title: "Admin", href: "/admin", icon: Shield, roles: ["admin"] },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
        isActive
          ? "nav-active"
          : "text-muted-foreground nav-hover",
        collapsed && "justify-center px-2"
      )}
    >
      {isActive && (
        <motion.span
          layoutId="nav-glow"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-vedha-teal/15 to-vedha-gold/10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={cn("relative z-10 h-4 w-4 shrink-0", isActive && "text-vedha-cyan")} />
      {!collapsed && <span className="relative z-10">{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="glass border-white/10">
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

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || hasRole(user, item.roles));

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
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-vedha-animated glow-vedha shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="overflow-hidden"
                >
                  <p className="text-base font-bold tracking-tight">TaskFlow</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-vedha-gold/80">
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
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left text-sm transition hover:border-vedha-teal/30 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-vedha-cyan/25"
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
              <DropdownMenuContent className="w-56 glass border-white/10" align="start">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuItem disabled>{workspace}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Navigate
              </p>
            )}
            {filterByRole(mainNav).map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>

          <Separator className="my-4 mx-3 bg-border dark:bg-white/[0.06]" />

          <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
            {filterByRole(secondaryNav).map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-3 space-y-2 dark:border-white/[0.06]">
          {!collapsed && (
            <Link
              href="/search"
              className="nav-hover flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground"
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

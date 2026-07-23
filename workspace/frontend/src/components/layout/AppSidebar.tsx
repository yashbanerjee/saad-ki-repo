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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, hasRole } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function AppSidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const user = useAuthStore((s) => s.user);

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || hasRole(user, item.roles));

  return (
    <TooltipProvider>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col border-r border-sidebar-border bg-sidebar h-full shrink-0"
      >
        <div className={cn("flex h-16 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-2")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-teal">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-display text-lg font-bold whitespace-nowrap overflow-hidden"
                >
                  TaskFlow
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className={cn("space-y-1 px-3", collapsed && "px-2")}>
            {filterByRole(mainNav).map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>

          <Separator className="my-4 mx-3" />

          <nav className={cn("space-y-1 px-3", collapsed && "px-2")}>
            {filterByRole(secondaryNav).map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={toggle}
            className={cn("w-full", collapsed && "h-9 w-9")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

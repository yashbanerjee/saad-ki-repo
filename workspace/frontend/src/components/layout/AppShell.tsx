"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Bug,
  Receipt,
  Users,
  Settings,
  Trash2,
} from "lucide-react";
import { VedhaMark } from "@/components/brand/VedhaMark";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { AppBreadcrumbs } from "./Breadcrumbs";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { AuthGuard } from "./AuthGuard";
import { AiAssistant } from "./AiAssistant";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, hasRole, isClientUser } from "@/lib/auth-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const homeHref = isClientUser(user) ? "/client-portal" : "/dashboard";

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0 md:hidden">
            <SheetHeader className="flex h-16 flex-row items-center space-y-0 border-b px-4 text-left">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Link
                href={homeHref}
                className="flex items-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <VedhaMark className="h-8 w-8" />
                <span>
                  <span className="block text-base font-bold">TaskFlow</span>
                  <span className="block text-[10px] font-normal uppercase tracking-widest text-muted-foreground">
                    by Vedha
                  </span>
                </span>
              </Link>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <MobileNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNavbar onOpenCommand={() => setOpen(true)} />
          <main className="flex-1 overflow-auto scrollbar-thin">
            <div className="container mx-auto max-w-[1400px] p-4 lg:p-8">
              <AppBreadcrumbs />
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="page-enter"
              >
                {children}
              </motion.div>
            </div>
          </main>
        </div>

        <CommandPalette open={open} onOpenChange={setOpen} />
        <AiAssistant />
      </div>
    </AuthGuard>
  );
}

const mobileLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "member"] as const,
  },
  {
    href: "/client-portal",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["client"] as const,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["admin", "manager", "member", "client"] as const,
  },
  { href: "/issues", label: "Issues", icon: Bug, roles: ["client"] as const },
  {
    href: "/invoices",
    label: "Invoices",
    icon: Receipt,
    roles: ["admin", "manager", "member", "client"] as const,
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    roles: ["admin", "manager", "member"] as const,
  },
  { href: "/team", label: "Team", icon: Users, roles: ["admin", "manager"] as const },
  {
    href: "/trash",
    label: "Trash",
    icon: Trash2,
    roles: ["admin", "manager", "member", "client"] as const,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin", "manager", "member", "client"] as const,
  },
];

function MobileNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const links = mobileLinks.filter(
    (link) => !link.roles || hasRole(user, [...link.roles]),
  );

  return (
    <nav className="space-y-1 p-3">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

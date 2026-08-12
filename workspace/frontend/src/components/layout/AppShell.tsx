"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { AppBreadcrumbs } from "./Breadcrumbs";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { AuthGuard } from "./AuthGuard";
import { AiAssistant } from "./AiAssistant";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, hasRole, isClientUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              className="chrome-sidebar absolute left-0 top-0 h-full w-72"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <Link
                  href={homeHref}
                  className="flex items-center gap-2"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-vedha">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-foreground">TaskFlow</span>
                    <p className="text-[10px] uppercase tracking-widest text-vedha-gold/80">
                      by Vedha
                    </p>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-4rem)]">
                <MobileNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </ScrollArea>
            </motion.div>
          </div>
        )}

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
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "manager", "member"] as const },
  { href: "/client-portal", label: "Dashboard", roles: ["client"] as const },
  { href: "/projects", label: "Projects", roles: ["admin", "manager", "member", "client"] as const },
  { href: "/issues", label: "Issues", roles: ["client"] as const },
  { href: "/documents", label: "Documents", roles: ["admin", "manager", "member", "client"] as const },
  { href: "/invoices", label: "Invoices", roles: ["admin", "manager", "member", "client"] as const },
  { href: "/clients", label: "Clients", roles: ["admin", "manager", "member"] as const },
  { href: "/team", label: "Team", roles: ["admin", "manager"] as const },
  { href: "/settings", label: "Settings", roles: ["admin", "manager", "member", "client"] as const },
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
    <nav className="space-y-1 p-4">
      {links.map((link) => (
        <Link
          key={`${link.href}-${link.label}`}
          href={link.href}
          onClick={onNavigate}
          className={cn(
            "block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === link.href || pathname.startsWith(`${link.href}/`)
              ? "nav-active text-vedha-teal dark:text-vedha-cyan"
              : "text-muted-foreground nav-hover"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

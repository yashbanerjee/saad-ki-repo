"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { AppBreadcrumbs } from "./Breadcrumbs";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { AuthGuard } from "./AuthGuard";
import { useSidebarStore } from "@/lib/sidebar-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border">
              <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-teal">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-display text-lg font-bold">TaskFlow</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-4rem)]">
                <MobileNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNavbar onOpenCommand={() => setOpen(true)} />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
              <AppBreadcrumbs />
              {children}
            </div>
          </main>
        </div>

        <CommandPalette open={open} onOpenChange={setOpen} />
      </div>
    </AuthGuard>
  );
}

const mobileLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/issues", label: "Issues" },
  { href: "/clients", label: "Clients" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];

function MobileNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className="p-4 space-y-1">
      {mobileLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={cn(
            "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith(link.href)
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

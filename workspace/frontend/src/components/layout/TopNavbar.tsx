"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  LogOut,
  User,
  Settings,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { cn, formatRelativeTime, getInitials, notificationHref } from "@/lib/utils";
import { authApi, notificationsApi } from "@/lib/api";
import { toast } from "sonner";

interface TopNavbarProps {
  onOpenCommand: () => void;
}

export function TopNavbar({ onOpenCommand }: TopNavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["notifications", "recent-popup"],
    queryFn: async () => {
      try {
        return await notificationsApi.list({ recent: true, limit: 10, page: 1 });
      } catch {
        // Fallback if recent filter is unavailable on older API deploys
        return notificationsApi.list({ limit: 10, page: 1 });
      }
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const payload = data?.data?.data ?? data?.data;
  const notifications = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const unreadCount =
    typeof payload?.unreadCount === "number"
      ? payload.unreadCount
      : notifications.filter((n: { read?: boolean }) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // local logout anyway
    }
    logout();
    document.cookie = "taskflow-auth-token=; path=/; max-age=0";
    toast.success("Signed out successfully");
    router.push("/login");
  };

  return (
    <header className="chrome-bar sticky top-0 z-40 flex h-16 items-center gap-3 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex flex-1 items-center justify-center sm:justify-start">
        <motion.button
          type="button"
          onClick={onOpenCommand}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex h-10 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 truncate">Search projects, issues, clients…</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </motion.button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={
            resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          className="relative"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full p-0 text-[9px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(100vw-2rem,22rem)] p-0"
            forceMount
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold">Notifications</p>
              <span className="text-[11px] text-muted-foreground">Last 2 days</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {isLoading || isFetching ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                  <p className="text-center text-xs text-muted-foreground">
                    Loading notifications...
                  </p>
                </div>
              ) : isError ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Couldn&apos;t load notifications right now.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => refetch()}>
                    Try again
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground max-w-[16rem]">
                    No new notifications in the last 2 days. We&apos;ll let you know
                    when something needs your attention.
                  </p>
                </div>
              ) : (
                notifications.map(
                  (n: {
                    id: string;
                    title?: string;
                    body?: string;
                    read?: boolean;
                    createdAt?: string;
                    data?: Record<string, unknown> | null;
                  }) => (
                    <button
                      key={n.id}
                      type="button"
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-b border-border/60 px-3 py-2.5 text-left transition hover:bg-muted/50",
                        !n.read && "bg-muted/70",
                      )}
                      onClick={() => {
                        if (!n.read) markRead.mutate(n.id);
                        const href = notificationHref(n.data);
                        if (href) router.push(href);
                        else router.push("/notifications");
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">
                          {n.title || "Notification"}
                        </p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.body && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      {n.createdAt && (
                        <p className="text-[11px] text-muted-foreground/80">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      )}
                    </button>
                  ),
                )
              )}
            </div>
            <div className="border-t border-border p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/notifications">See All</Link>
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
              <Avatar className="h-9 w-9 ring-1 ring-border ring-offset-2 ring-offset-background">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-muted text-xs">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                {user?.companyName && (
                  <p className="mt-1 text-xs text-muted-foreground">{user.companyName}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

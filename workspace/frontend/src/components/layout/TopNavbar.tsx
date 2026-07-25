"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { getInitials } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface TopNavbarProps {
  onOpenCommand: () => void;
}

export function TopNavbar({ onOpenCommand }: TopNavbarProps) {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const router = useRouter();

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
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#09090B]/70 px-4 backdrop-blur-[20px] lg:px-6">
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
          className="group flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-left text-sm text-muted-foreground shadow-glass transition-all hover:border-vedha-cyan/25 hover:bg-white/[0.05] hover:shadow-glow"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 text-vedha-cyan/80" />
          <span className="flex-1 truncate">Search projects, issues, clients…</span>
          <kbd className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </motion.button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="relative"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full p-0 text-[9px]">
              3
            </Badge>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
              <Avatar className="h-9 w-9 ring-1 ring-white/10 ring-offset-2 ring-offset-[#09090B]">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-vedha-teal/30 text-vedha-cyan text-xs">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 glass border-white/10" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                {user?.companyName && (
                  <p className="mt-1 text-xs text-vedha-gold/80">{user.companyName}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/8" />
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
            <DropdownMenuSeparator className="bg-white/8" />
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

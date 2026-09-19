"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronsUpDown,
  Search,
  Trash2,
  Star,
  Filter,
  Users,
  FolderKanban,
  LayoutGrid,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VedhaMark } from "@/components/brand/VedhaMark";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore, isClientUser } from "@/lib/auth-store";
import { projectsApi } from "@/lib/api";
import { getRecentSpaces } from "@/lib/recent-spaces";
import { spaceHref } from "@/lib/space-paths";
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
import { useEffect, useState } from "react";

function SideLink({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  active?: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

function SpaceRow({
  id,
  name,
  avatar,
  collapsed,
  active,
}: {
  id: string;
  name: string;
  avatar?: string | null;
  collapsed: boolean;
  active: boolean;
}) {
  const href = spaceHref(id);
  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-[#0C66E4]/12 text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-[#0C66E4]/15 text-[#0C66E4]">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <FolderKanban className="h-3.5 w-3.5" />
        )}
      </span>
      {!collapsed && <span className="truncate">{name}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
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
  const pathname = usePathname();
  const [recent, setRecent] = useState<ReturnType<typeof getRecentSpaces>>([]);

  useEffect(() => {
    setRecent(getRecentSpaces());
  }, [pathname]);

  const { data: spacesData } = useQuery({
    queryKey: ["spaces", "sidebar"],
    queryFn: () => projectsApi.list({ limit: 20 }),
    enabled: !isClient,
    retry: false,
  });

  const spacesRaw = spacesData?.data?.data ?? spacesData?.data ?? [];
  const spaces = Array.isArray(spacesRaw) ? spacesRaw : [];

  const activeSpaceId = pathname.match(/\/spaces\/([^/]+)/)?.[1];

  return (
    <TooltipProvider>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 272 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="chrome-sidebar ads-sidebar hidden md:flex flex-col h-full shrink-0"
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border px-4 dark:border-white/[0.06]",
            collapsed && "justify-center px-2",
          )}
        >
          <Link href={homeHref} className="flex items-center gap-2.5">
            <VedhaMark
              className="h-9 w-9"
              src={user?.companyLogo || user?.companyFavicon}
              alt={workspace}
            />
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
                      Company
                    </p>
                    <p className="truncate font-medium">{workspace}</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel>Companies</DropdownMenuLabel>
                <DropdownMenuItem disabled>{workspace}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isClient && (
            <Button
              className={cn(
                "w-full justify-start gap-2 bg-[#0C66E4] text-white hover:bg-[#0055CC]",
                collapsed && "px-0 justify-center",
              )}
              size={collapsed ? "icon" : "default"}
              asChild
            >
              <Link href="/spaces?create=1">
                <Plus className="h-4 w-4" />
                {!collapsed && "Create"}
              </Link>
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
            <SideLink
              href={homeHref}
              label="For you"
              icon={LayoutDashboard}
              collapsed={collapsed}
              active={pathname === homeHref || pathname === "/dashboard"}
            />
            {!isClient && recent.length > 0 && (
              <>
                {!collapsed && (
                  <p className="mb-1 mt-4 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Recent
                  </p>
                )}
                {collapsed && <Separator className="my-2" />}
                {recent.slice(0, 4).map((s) => (
                  <SpaceRow
                    key={`recent-${s.id}`}
                    id={s.id}
                    name={s.name}
                    avatar={s.avatar}
                    collapsed={collapsed}
                    active={activeSpaceId === s.id}
                  />
                ))}
              </>
            )}

            {!isClient && (
              <>
                {!collapsed && (
                  <p className="mb-1 mt-4 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Spaces
                  </p>
                )}
                {collapsed && <Separator className="my-2" />}
                {spaces.slice(0, 8).map(
                  (s: { id: string; name: string; avatar?: string | null }) => (
                    <SpaceRow
                      key={s.id}
                      id={s.id}
                      name={s.name}
                      avatar={s.avatar}
                      collapsed={collapsed}
                      active={activeSpaceId === s.id}
                    />
                  ),
                )}
                <SideLink
                  href="/spaces"
                  label="More spaces"
                  icon={LayoutGrid}
                  collapsed={collapsed}
                  active={pathname === "/spaces"}
                />
              </>
            )}

            {isClient && (
              <>
                <SideLink
                  href="/spaces"
                  label="Spaces"
                  icon={FolderKanban}
                  collapsed={collapsed}
                  active={pathname.startsWith("/spaces") || pathname.startsWith("/projects")}
                />
                <SideLink
                  href="/invoices"
                  label="Invoices"
                  icon={Receipt}
                  collapsed={collapsed}
                  active={pathname.startsWith("/invoices")}
                />
              </>
            )}
          </nav>

          {!isClient && (
            <>
              <Separator className="my-4 mx-3 bg-border dark:bg-white/[0.06]" />
              <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
                <SideLink
                  href="/search"
                  label="Filters"
                  icon={Filter}
                  collapsed={collapsed}
                  active={pathname.startsWith("/search")}
                />
                <SideLink
                  href="/dashboard"
                  label="Dashboards"
                  icon={Star}
                  collapsed={collapsed}
                  active={false}
                />
                <SideLink
                  href="/team"
                  label="Teams"
                  icon={Users}
                  collapsed={collapsed}
                  active={pathname.startsWith("/team")}
                />
                <SideLink
                  href="/invoices"
                  label="Invoices"
                  icon={Receipt}
                  collapsed={collapsed}
                  active={pathname.startsWith("/invoices")}
                />
                <SideLink
                  href="/clients"
                  label="Clients"
                  icon={Users}
                  collapsed={collapsed}
                  active={pathname.startsWith("/clients")}
                />
              </nav>
            </>
          )}

          <Separator className="my-4 mx-3 bg-border dark:bg-white/[0.06]" />
          <nav className={cn("space-y-0.5 px-3", collapsed && "px-2")}>
            <SideLink
              href="/trash"
              label="Trash"
              icon={Trash2}
              collapsed={collapsed}
              active={pathname.startsWith("/trash")}
            />
            <SideLink
              href="/settings"
              label="Settings"
              icon={Settings}
              collapsed={collapsed}
              active={pathname.startsWith("/settings")}
            />
          </nav>
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

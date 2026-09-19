"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore, hasRole, isClientUser } from "@/lib/auth-store";
import { workspaceApps } from "@/lib/workspace-apps";
import { cn } from "@/lib/utils";

export function WorkspaceAppsLauncher() {
  const user = useAuthStore((s) => s.user);

  if (isClientUser(user)) return null;

  const apps = workspaceApps.filter(
    (app) => !app.roles || hasRole(user, app.roles),
  );

  if (apps.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open Workspace apps"
          title="Workspace"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,22rem)] p-0 overflow-hidden rounded-2xl border border-border/80 shadow-xl"
      >
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">Workspace</p>
          <p className="text-[11px] text-muted-foreground">
            CRM, calendar, docs, and team tools
          </p>
        </div>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <DropdownMenuItem key={app.id} asChild className="p-0 focus:bg-transparent">
                  <Link
                    href={app.href}
                    className={cn(
                      "group flex cursor-pointer flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors",
                      "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-[1.04]",
                        app.tone,
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-[12px] font-medium leading-tight text-foreground">
                      {app.title}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/70 bg-muted/30 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Tip: keep delivery in the sidebar — open CRM & tools here
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

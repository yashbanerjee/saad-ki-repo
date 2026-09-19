"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, MoreHorizontal, Star, Users } from "lucide-react";
import { projectsApi } from "@/lib/api";
import { pushRecentSpace } from "@/lib/recent-spaces";
import { SPACE_TABS, activeSpaceTab } from "@/lib/space-paths";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SpaceShell({
  spaceId,
  children,
}: {
  spaceId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tab = activeSpaceTab(pathname);

  const { data, isLoading } = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => projectsApi.get(spaceId),
  });

  const space = data?.data?.data ?? data?.data;
  const name = space?.name ?? "Space";
  const avatar = space?.avatar ?? space?.logoUrl ?? null;

  useEffect(() => {
    if (space?.id && space?.name) {
      pushRecentSpace({ id: space.id, name: space.name, avatar });
    }
  }, [space?.id, space?.name, avatar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-muted-foreground">
            <Link href="/spaces" className="hover:underline">
              Spaces
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{isLoading ? "…" : name}</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0C66E4]/15 text-[#0C66E4]">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <FolderKanban className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
              )}
              {space?.client && (
                <p className="text-xs text-muted-foreground">
                  {typeof space.client === "string"
                    ? space.client
                    : space.client.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Members" asChild>
            <Link href={`/spaces/${spaceId}`}>
              <Users className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Star" disabled>
            <Star className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/spaces/${spaceId}`}>Space settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/spaces">All spaces</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="ads-space-tabs -mx-1 flex gap-0 overflow-x-auto border-b border-border px-1">
        {SPACE_TABS.map((t) => {
          const href = t.href(spaceId);
          const isActive = tab === t.id;
          return (
            <Link
              key={t.id}
              href={href}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {"stub" in t && t.stub ? (
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  ·
                </span>
              ) : null}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#0C66E4]" />
              )}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}

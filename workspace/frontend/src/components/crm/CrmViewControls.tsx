"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Props = {
  view: "board" | "list";
  onViewChange: (v: "board" | "list") => void;
  search: string;
  onSearchChange: (v: string) => void;
  className?: string;
  rightSlot?: React.ReactNode;
};

export function CrmViewControls({
  view,
  onViewChange,
  search,
  onSearchChange,
  className,
  rightSlot,
}: Props) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 justify-between", className)}>
      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-9"
          />
        </div>
        <Tabs value={view} onValueChange={(v) => onViewChange(v as "board" | "list")}>
          <TabsList className="h-9">
            <TabsTrigger value="board" className="text-xs gap-1">
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="text-xs gap-1">
              <List className="h-3.5 w-3.5" /> List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {rightSlot}
    </div>
  );
}

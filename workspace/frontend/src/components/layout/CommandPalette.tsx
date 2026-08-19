"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Bug,
  Users,
  Settings,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { isClientUser, useAuthStore } from "@/lib/auth-store";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isClient = isClientUser(user);
  const homeHref = isClient ? "/client-portal" : "/dashboard";

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push(homeHref))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/projects"))}>
            <FolderKanban className="mr-2 h-4 w-4" />
            Projects
          </CommandItem>
          {!isClient && (
            <CommandItem onSelect={() => runCommand(() => router.push("/issues"))}>
              <Bug className="mr-2 h-4 w-4" />
              Issues
            </CommandItem>
          )}
          {!isClient && (
            <CommandItem onSelect={() => runCommand(() => router.push("/clients"))}>
              <Users className="mr-2 h-4 w-4" />
              Clients
            </CommandItem>
          )}
          {!isClient && (
            <CommandItem onSelect={() => runCommand(() => router.push("/team"))}>
              <Users className="mr-2 h-4 w-4" />
              Team
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => router.push("/trash"))}>
            <Trash2 className="mr-2 h-4 w-4" />
            Trash
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        {!isClient && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => runCommand(() => router.push("/projects?create=true"))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Project
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/issues?create=true"))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Issue
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/search"))}>
                <Search className="mr-2 h-4 w-4" />
                Advanced Search
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}

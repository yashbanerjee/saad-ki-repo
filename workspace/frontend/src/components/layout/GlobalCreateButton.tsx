"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FolderKanban, ListTodo, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentsApi, issuesApi, projectsApi } from "@/lib/api";
import { getRecentSpaces } from "@/lib/recent-spaces";
import { spaceHref } from "@/lib/space-paths";
import {
  defaultDueDatetimeLocal,
  fromDatetimeLocalValue,
} from "@/lib/calendar-events";
import { isClientUser, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

type CreateKind = "work" | "doc" | "space" | null;

export function GlobalCreateButton() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<CreateKind>(null);
  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDatetimeLocal());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const pathSpaceId = pathname.match(/\/spaces\/([^/]+)/)?.[1] ?? "";

  const { data: spacesData } = useQuery({
    queryKey: ["spaces", "create"],
    queryFn: () => projectsApi.list({ limit: 50 }),
    enabled: !isClientUser(user) && kind !== null,
    retry: false,
  });

  const spaces = useMemo(() => {
    const raw = spacesData?.data?.data ?? spacesData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [spacesData]);

  useEffect(() => {
    if (kind === null) return;
    const recent = getRecentSpaces()[0]?.id;
    setSpaceId(pathSpaceId || recent || spaces[0]?.id || "");
    if (kind === "work") setDueDate(defaultDueDatetimeLocal());
  }, [kind, pathSpaceId, spaces]);

  const createWork = useMutation({
    mutationFn: () => {
      const due = fromDatetimeLocalValue(dueDate);
      if (!due) throw new Error("Due date and time are required");
      return issuesApi.create({
        title,
        description: description || undefined,
        projectId: spaceId,
        type: "TASK",
        priority: "MEDIUM",
        status: "TODO",
        dueDate: due,
      });
    },
    onSuccess: (res) => {
      const issue = res.data?.data ?? res.data;
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["project-board", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success("Work item created — visible on calendar");
      setKind(null);
      setTitle("");
      setDescription("");
      setDueDate(defaultDueDatetimeLocal());
      if (issue?.id) router.push(`/issues/${issue.id}`);
      else router.push(spaceHref(spaceId, "board"));
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error && err.message === "Due date and time are required"
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Could not create";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const createSpace = useMutation({
    mutationFn: () =>
      projectsApi.create({
        name: title,
        description,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    onSuccess: (res) => {
      const project = res.data?.data ?? res.data;
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success("Space created");
      setKind(null);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      if (project?.id) router.push(spaceHref(project.id));
      else router.push("/spaces");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not create space";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const uploadDoc = useMutation({
    mutationFn: (file: File) =>
      documentsApi.upload(file, {
        name: file.name,
        projectId: spaceId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded — visible in space & global Docs");
      setKind(null);
      if (spaceId) router.push(spaceHref(spaceId, "docs"));
      else router.push("/documents");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Upload failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  if (isClientUser(user)) return null;

  const pending =
    createWork.isPending || createSpace.isPending || uploadDoc.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="ads-create-btn h-9 gap-1.5 bg-[#0C66E4] px-3 font-medium text-white hover:bg-[#0055CC]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setKind("work")}>
            <ListTodo className="mr-2 h-4 w-4" /> Work item
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKind("doc")}>
            <FileText className="mr-2 h-4 w-4" /> Document
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKind("space")}>
            <FolderKanban className="mr-2 h-4 w-4" /> Space
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={kind !== null} onOpenChange={(o) => !o && setKind(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {kind === "work" && "Create work item"}
              {kind === "doc" && "Upload document"}
              {kind === "space" && "Create space"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(kind === "work" || kind === "doc") && (
              <div className="space-y-2">
                <Label>Space</Label>
                <Select value={spaceId} onValueChange={setSpaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {kind === "work" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-title">Title</Label>
                  <Input
                    id="create-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-due">Due date & time</Label>
                  <Input
                    id="create-due"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required so this item appears on the calendar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-desc">Description</Label>
                  <Textarea
                    id="create-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

            {kind === "space" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="space-name">Name</Label>
                  <Input
                    id="space-name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Space name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="space-start">Start date</Label>
                    <Input
                      id="space-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="space-end">Target end</Label>
                    <Input
                      id="space-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="space-desc">Description</Label>
                  <Textarea
                    id="space-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

            {kind === "doc" && (
              <div className="space-y-2">
                <Label>File</Label>
                <input
                  ref={fileRef}
                  type="file"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!spaceId) {
                        toast.error("Select a space first");
                        return;
                      }
                      uploadDoc.mutate(file);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Uploaded files appear in the space Docs tab and global Docs.
                </p>
              </div>
            )}
          </div>

          {kind !== "doc" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setKind(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#0C66E4] hover:bg-[#0055CC]"
                disabled={
                  pending ||
                  !title.trim() ||
                  (kind === "work" && (!spaceId || !dueDate))
                }
                onClick={() => {
                  if (kind === "work") createWork.mutate();
                  if (kind === "space") createSpace.mutate();
                }}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

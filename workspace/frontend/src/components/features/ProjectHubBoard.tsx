"use client";

import Link from "next/link";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
import type { KanbanColumn, KanbanTask } from "@/components/features/KanbanBoard";

function formatShortDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function prettyStatus(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "TODO" || s === "BACKLOG") return "Not started";
  if (s === "IN_PROGRESS") return "In progress";
  if (s === "TESTING" || s === "IN_REVIEW") return "In review";
  if (s === "DONE") return "Done";
  if (s === "BLOCKED") return "Blocked";
  if (s === "CANCELLED") return "Cancelled";
  return (status || "").replace(/_/g, " ") || "Not started";
}

function statusBadgeVariant(
  status?: string,
): "default" | "secondary" | "outline" | "warning" {
  const s = (status || "").toUpperCase();
  if (s === "IN_PROGRESS") return "default";
  if (s === "BLOCKED") return "warning";
  if (s === "DONE") return "secondary";
  return "outline";
}

function columnDot(id: string, title: string) {
  const s = `${id} ${title}`.toLowerCase();
  if (s.includes("progress") || s.includes("doing")) return "bg-[#E5FF00]";
  if (s.includes("review") || s.includes("test")) return "border border-foreground/25 bg-transparent";
  if (s.includes("done") || s.includes("complete")) return "bg-foreground";
  return "border border-foreground/25 bg-transparent";
}

function HubCard({ task }: { task: KanbanTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-60")}
    >
      <Link
        href={`/issues/${task.id}`}
        className="block rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={statusBadgeVariant(task.status)}
            className="rounded-full px-2 py-0 text-[10px] font-medium"
          >
            {prettyStatus(task.status)}
          </Badge>
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {formatShortDate(task.dueDate) || "—"}
          </span>
          {task.assignee ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-muted text-[8px]">
                  {getInitials(task.assignee)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs text-muted-foreground">{task.assignee}</span>
            </span>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

function HubColumn({ column }: { column: KanbanColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", columnDot(column.id, column.title))} />
        <h3 className="text-sm font-semibold">
          {column.title}{" "}
          <span className="font-normal text-muted-foreground">({column.tasks.length})</span>
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={cn("min-h-[160px] space-y-3 rounded-2xl p-0.5", isOver && "bg-muted/50")}
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <HubCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function ProjectHubBoard({
  columns,
  onTaskMove,
}: {
  columns: KanbanColumn[];
  onTaskMove?: (taskId: string, fromColumn: string, toColumn: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);

    const source = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    const dest =
      columns.find((c) => c.id === overId) ||
      columns.find((c) => c.tasks.some((t) => t.id === overId));
    if (!source || !dest || source.id === dest.id) return;
    onTaskMove?.(taskId, source.id, dest.id);
  };

  if (columns.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No board columns yet.</p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <HubColumn key={column.id} column={column} />
        ))}
      </div>
    </DndContext>
  );
}

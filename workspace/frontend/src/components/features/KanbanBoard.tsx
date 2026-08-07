"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Plus, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

export interface KanbanTask {
  id: string;
  key?: string;
  title: string;
  priority: "low" | "medium" | "high";
  assignee?: string;
  labels?: string[];
  dueDate?: string;
  progress?: number;
  status?: string;
  type?: string;
  milestoneId?: string | null;
  milestoneName?: string;
  estimatedHours?: number | null;
  loggedHours?: number | null;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tasks: KanbanTask[];
}

const priorityColors = {
  low: "secondary" as const,
  medium: "warning" as const,
  high: "destructive" as const,
};

const priorityBar = {
  low: "bg-vedha-cyan",
  medium: "bg-vedha-gold",
  high: "bg-red-400",
};

export const defaultColumns: KanbanColumn[] = [
  { id: "TODO", title: "Todo", tasks: [] },
  { id: "IN_PROGRESS", title: "In Progress", tasks: [] },
  { id: "TESTING", title: "Testing", tasks: [] },
  { id: "DONE", title: "Done", tasks: [] },
];

function SortableTask({
  task,
  href,
  onTaskClick,
}: {
  task: KanbanTask;
  href?: string;
  onTaskClick?: (task: KanbanTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = (
    <>
      {(task.milestoneName ||
        task.loggedHours != null ||
        task.estimatedHours != null) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          {task.milestoneName && (
            <span className="rounded border px-1.5 py-0.5">{task.milestoneName}</span>
          )}
          {(task.loggedHours != null || task.estimatedHours != null) && (
            <span className="rounded border px-1.5 py-0.5">
              {task.loggedHours ?? 0}h
              {task.estimatedHours != null ? ` / ${task.estimatedHours}h` : " logged"}
            </span>
          )}
        </div>
      )}
    </>
  );

  const body = (
    <>
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-l-xl", priorityBar[task.priority])} />
      <div className="flex items-start gap-2 pl-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
          aria-label="Drag task"
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          {task.key && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {task.key}
            </p>
          )}
          <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
          {meta}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityColors[task.priority]} className="text-[10px] capitalize">
              {task.priority}
            </Badge>
            {task.type && (
              <Badge variant="outline" className="text-[10px]">
                {task.type}
              </Badge>
            )}
            {task.labels?.map((label) => (
              <Badge key={label} variant="outline" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
          {(task.dueDate || task.assignee) && (
            <div className="mt-2.5 flex items-center gap-2">
              {task.assignee && (
                <Avatar className="h-6 w-6 border border-border">
                  <AvatarFallback className="bg-vedha-teal/15 text-[9px] text-vedha-teal dark:bg-vedha-teal/30 dark:text-vedha-cyan">
                    {getInitials(task.assignee)}
                  </AvatarFallback>
                </Avatar>
              )}
              {task.dueDate && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {task.dueDate}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative z-10 overflow-hidden rounded-xl border border-border bg-background p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing transition-all duration-200",
        "hover:border-vedha-teal/40 hover:shadow-md",
        isDragging && "opacity-50 ring-2 ring-vedha-teal/25",
        onTaskClick && "cursor-pointer",
      )}
      onClick={() => onTaskClick?.(task)}
    >
      {href ? (
        <Link href={href} className="block" onClick={(e) => e.stopPropagation()}>
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

function TaskOverlay({ task }: { task: KanbanTask }) {
  return (
    <div className="w-72 rotate-1 rounded-xl border border-vedha-teal/30 bg-card p-3 shadow-lg">
      {task.key && (
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{task.key}</p>
      )}
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      <Badge variant={priorityColors[task.priority]} className="mt-2 text-[10px] capitalize">
        {task.priority}
      </Badge>
    </div>
  );
}

function StaticTask({ task }: { task: KanbanTask }) {
  return (
    <div className="group relative z-10 overflow-hidden rounded-xl border border-border bg-background p-3 shadow-sm">
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1 rounded-l-xl",
          priorityBar[task.priority],
        )}
      />
      <div className="min-w-0 pl-2">
        {task.key && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {task.key}
          </p>
        )}
        <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={priorityColors[task.priority]}
            className="text-[10px] capitalize"
          >
            {task.priority}
          </Badge>
          {task.type && (
            <Badge variant="outline" className="text-[10px]">
              {task.type}
            </Badge>
          )}
          {task.labels?.map((label) => (
            <Badge key={label} variant="outline" className="text-[10px]">
              {label}
            </Badge>
          ))}
        </div>
        {(task.dueDate || task.assignee) && (
          <div className="mt-2.5 flex items-center gap-2">
            {task.assignee && (
              <Avatar className="h-6 w-6 border border-border">
                <AvatarFallback className="bg-vedha-teal/15 text-[9px] text-vedha-teal dark:bg-vedha-teal/30 dark:text-vedha-cyan">
                  {getInitials(task.assignee)}
                </AvatarFallback>
              </Avatar>
            )}
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {task.dueDate}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  initialColumns?: KanbanColumn[];
  onTaskMove?: (taskId: string, fromColumn: string, toColumn: string) => void;
  onAddTask?: (columnId: string) => void;
  onTaskClick?: (task: KanbanTask) => void;
  canCreate?: boolean;
  /** Public / client view — no drag, no add task */
  readOnly?: boolean;
  taskHref?: (task: KanbanTask) => string;
}

function DroppableColumn({
  column,
  children,
}: {
  column: KanbanColumn;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      className="w-80 flex-shrink-0"
      animate={{ scale: isOver ? 1.01 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <Card
        className={cn(
          "h-full border-border !bg-muted/50 !shadow-none",
          isOver && "border-vedha-teal/40 !bg-muted/70",
        )}
      >
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
              {column.title || "Column"}
            </CardTitle>
            <Badge variant="secondary">{column.tasks.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="min-h-[220px] space-y-2.5 px-3 pb-3">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function KanbanBoard({
  initialColumns = defaultColumns,
  onTaskMove,
  onAddTask,
  onTaskClick,
  canCreate = true,
  readOnly = false,
  taskHref,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const findColumn = (taskId: string) =>
    columns.find((col) => col.tasks.some((t) => t.id === taskId));

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return;
    const task = event.active.data.current?.task as KanbanTask;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = findColumn(activeId);
    let destColumn = columns.find((c) => c.id === overId);
    if (!destColumn) destColumn = findColumn(overId);
    if (!sourceColumn || !destColumn || sourceColumn.id === destColumn.id) return;

    const task = sourceColumn.tasks.find((t) => t.id === activeId);
    if (!task) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceColumn.id) {
          return { ...col, tasks: col.tasks.filter((t) => t.id !== activeId) };
        }
        if (col.id === destColumn!.id) {
          return { ...col, tasks: [...col.tasks, { ...task, status: destColumn!.id }] };
        }
        return col;
      }),
    );

    onTaskMove?.(activeId, sourceColumn.id, destColumn.id);
  };

  if (readOnly) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((column) => (
          <div key={column.id} className="w-80 flex-shrink-0">
            <Card className="h-full border-border !bg-muted/50 !shadow-none">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
                    {column.title || "Column"}
                  </CardTitle>
                  <Badge variant="secondary">{column.tasks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="min-h-[220px] space-y-2.5 px-3 pb-3">
                {column.tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                    No items
                  </p>
                ) : (
                  column.tasks.map((task) => (
                    <StaticTask key={task.id} task={task} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((column) => (
          <DroppableColumn key={column.id} column={column}>
            <SortableContext
              items={column.tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {column.tasks.map((task) => (
                <SortableTask
                  key={task.id}
                  task={task}
                  href={taskHref?.(task)}
                  onTaskClick={onTaskClick}
                />
              ))}
            </SortableContext>
            {canCreate && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onAddTask?.(column.id)}
              >
                <Plus className="mr-1 h-4 w-4" /> Add task
              </Button>
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskOverlay task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}

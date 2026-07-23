"use client";

import { useState } from "react";
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
import { GripVertical, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface KanbanTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  assignee?: string;
  labels?: string[];
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

function SortableTask({ task }: { task: KanbanTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityColors[task.priority]} className="text-[10px]">
              {task.priority}
            </Badge>
            {task.labels?.map((label) => (
              <Badge key={label} variant="outline" className="text-[10px]">{label}</Badge>
            ))}
          </div>
          {task.assignee && (
            <p className="mt-2 text-xs text-muted-foreground">{task.assignee}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskOverlay({ task }: { task: KanbanTask }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl ring-2 ring-primary/30 w-64">
      <p className="text-sm font-medium">{task.title}</p>
      <Badge variant={priorityColors[task.priority]} className="mt-2 text-[10px]">{task.priority}</Badge>
    </div>
  );
}

interface KanbanBoardProps {
  initialColumns?: KanbanColumn[];
  onTaskMove?: (taskId: string, fromColumn: string, toColumn: string) => void;
}

const defaultColumns: KanbanColumn[] = [
  {
    id: "todo",
    title: "Todo",
    tasks: [
      { id: "1", title: "Design system audit", priority: "high", assignee: "Alex M.", labels: ["Design"] },
      { id: "2", title: "API documentation", priority: "medium", assignee: "Sarah K.", labels: ["Docs"] },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    tasks: [
      { id: "3", title: "Implement auth flow", priority: "high", assignee: "James L.", labels: ["Backend"] },
      { id: "4", title: "Dashboard wireframes", priority: "medium", assignee: "Alex M.", labels: ["Design"] },
    ],
  },
  {
    id: "review",
    title: "Review",
    tasks: [
      { id: "5", title: "Client portal mockups", priority: "medium", assignee: "Sarah K.", labels: ["Frontend"] },
    ],
  },
  {
    id: "done",
    title: "Done",
    tasks: [
      { id: "6", title: "Project setup & CI/CD", priority: "low", assignee: "James L.", labels: ["DevOps"] },
    ],
  },
];

function DroppableColumn({ column, children }: { column: KanbanColumn; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72">
      <Card className={cn("glass-subtle h-full", isOver && "ring-2 ring-primary/30")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
            <Badge variant="secondary">{column.tasks.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 min-h-[200px]">{children}</CardContent>
      </Card>
    </div>
  );
}

export function KanbanBoard({ initialColumns = defaultColumns, onTaskMove }: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const findColumn = (taskId: string) =>
    columns.find((col) => col.tasks.some((t) => t.id === taskId));

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as KanbanTask;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
          return { ...col, tasks: [...col.tasks, task] };
        }
        return col;
      })
    );

    onTaskMove?.(activeId, sourceColumn.id, destColumn.id);
  };

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
            <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {column.tasks.map((task) => (
                <SortableTask key={task.id} task={task} />
              ))}
            </SortableContext>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              <Plus className="h-4 w-4 mr-1" /> Add task
            </Button>
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskOverlay task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}

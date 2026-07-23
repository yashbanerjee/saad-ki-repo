"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/features/KanbanBoard";
import { projectsApi } from "@/lib/api";
import { toast } from "sonner";

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;

  const handleTaskMove = async (taskId: string, fromColumn: string, toColumn: string) => {
    try {
      await projectsApi.updateTaskStatus(projectId, taskId, toColumn);
      toast.success("Task moved");
    } catch {
      toast.info("Task moved locally (API unavailable)");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Kanban Board</h1>
          <p className="text-muted-foreground text-sm">Drag and drop tasks between columns</p>
        </div>
      </div>
      <KanbanBoard onTaskMove={handleTaskMove} />
    </div>
  );
}

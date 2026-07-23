"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const sprints = [
  { id: "1", name: "Sprint 5", status: "active", startDate: "2026-02-17", endDate: "2026-03-02", tasks: 12, completed: 7, goal: "Complete auth module and dashboard MVP" },
  { id: "2", name: "Sprint 4", status: "completed", startDate: "2026-02-03", endDate: "2026-02-16", tasks: 10, completed: 10, goal: "Design system and component library" },
  { id: "3", name: "Sprint 3", status: "completed", startDate: "2026-01-20", endDate: "2026-02-02", tasks: 8, completed: 8, goal: "Project setup and CI/CD pipeline" },
];

export default function SprintsPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Sprints</h1>
            <p className="text-muted-foreground text-sm">Plan and track sprint iterations</p>
          </div>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" /> New Sprint</Button>
      </div>

      <div className="space-y-4">
        {sprints.map((sprint) => (
          <Card key={sprint.id} className={sprint.status === "active" ? "border-primary/50" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{sprint.name}</CardTitle>
                  <Badge variant={sprint.status === "active" ? "success" : "secondary"}>
                    {sprint.status === "active" ? <><Play className="h-3 w-3 mr-1" /> Active</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</>}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                </span>
              </div>
              <CardDescription>{sprint.goal}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span>{sprint.completed}/{sprint.tasks} tasks</span>
                    <span>{Math.round((sprint.completed / sprint.tasks) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(sprint.completed / sprint.tasks) * 100}%` }}
                    />
                  </div>
                </div>
                {sprint.status === "active" && (
                  <Button size="sm" variant="outline">View Board</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

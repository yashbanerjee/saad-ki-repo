"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const backlogItems = [
  { id: "1", title: "User authentication flow", priority: "high", storyPoints: 8, epic: "Auth" },
  { id: "2", title: "Dashboard analytics widgets", priority: "medium", storyPoints: 5, epic: "Dashboard" },
  { id: "3", title: "Email notification templates", priority: "low", storyPoints: 3, epic: "Notifications" },
  { id: "4", title: "Export to PDF feature", priority: "medium", storyPoints: 5, epic: "Reports" },
  { id: "5", title: "Multi-language support", priority: "low", storyPoints: 13, epic: "i18n" },
  { id: "6", title: "Dark mode refinements", priority: "low", storyPoints: 2, epic: "UI" },
];

const priorityVariant = { high: "destructive" as const, medium: "warning" as const, low: "secondary" as const };

export default function BacklogPage() {
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
            <h1 className="font-display text-2xl font-bold">Backlog</h1>
            <p className="text-muted-foreground text-sm">{backlogItems.length} items prioritized</p>
          </div>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Product Backlog</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {backlogItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                <Checkbox />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.epic}</p>
                </div>
                <Badge variant={priorityVariant[item.priority as keyof typeof priorityVariant]}>{item.priority}</Badge>
                <Badge variant="outline">{item.storyPoints} pts</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

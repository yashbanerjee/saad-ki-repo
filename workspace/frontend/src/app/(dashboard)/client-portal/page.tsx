"use client";

import {
  FolderKanban,
  CheckCircle2,
  FileText,
  MessageCircle,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientPortalPage() {
  const projects: { id: string; name: string; progress: number; status: string; tasks: { done: number; total: number } }[] = [];
  const recentDocs: { name: string; date: string }[] = [];

  const stats = [
    { label: "Active Projects", value: "0", icon: FolderKanban },
    { label: "Completed Tasks", value: "0", icon: CheckCircle2 },
    { label: "Documents", value: "0", icon: FileText },
    { label: "Open Tickets", value: "0", icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Client Portal</h1>
        <p className="text-muted-foreground">Your projects, documents, and support</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Projects</CardTitle>
            <CardDescription>Track progress on active engagements</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects"
                description="Your assigned projects will appear here."
                className="py-10"
              />
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{project.name}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{project.tasks.done}/{project.tasks.total} tasks completed</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents shared yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentDocs.map((doc) => (
                    <div key={doc.name} className="flex items-center justify-between text-sm py-1">
                      <span>{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{doc.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Invoice management coming soon</p>
              <Button variant="outline" size="sm" disabled>View Invoices</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Need help? Open a support ticket</p>
              <Button size="sm">Contact Support <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

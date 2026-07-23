"use client";

import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  FileText,
  Receipt,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const projects = [
  { id: "1", name: "Website Redesign", progress: 68, status: "active", tasks: { done: 16, total: 24 } },
  { id: "2", name: "Mobile App v2", progress: 35, status: "active", tasks: { done: 15, total: 42 } },
];

const recentDocs = [
  { name: "Sprint 5 Report.pdf", date: "Feb 17" },
  { name: "Design Review Notes.docx", date: "Feb 15" },
];

export default function ClientPortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Client Portal</h1>
        <p className="text-muted-foreground">Your projects, documents, and support</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Projects", value: "2", icon: FolderKanban },
          { label: "Completed Tasks", value: "31", icon: CheckCircle2 },
          { label: "Documents", value: "8", icon: FileText },
          { label: "Open Tickets", value: "1", icon: MessageCircle },
        ].map((stat) => (
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
          <CardContent className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{project.name}</span>
                  <Badge variant="success">{project.status}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{project.tasks.done}/{project.tasks.total} tasks completed</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Recent Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentDocs.map((doc) => (
                <div key={doc.name} className="flex items-center justify-between text-sm py-1">
                  <span>{doc.name}</span>
                  <span className="text-xs text-muted-foreground">{doc.date}</span>
                </div>
              ))}
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

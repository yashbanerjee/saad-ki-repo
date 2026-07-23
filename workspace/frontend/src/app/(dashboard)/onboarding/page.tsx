"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { onboardingApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const mockForms = [
  { id: "1", name: "Client Intake Form", fields: 12, submissions: 8, status: "active", updatedAt: "2026-02-20" },
  { id: "2", name: "Project Kickoff Survey", fields: 8, submissions: 3, status: "active", updatedAt: "2026-02-15" },
  { id: "3", name: "Vendor Registration", fields: 15, submissions: 0, status: "draft", updatedAt: "2026-02-10" },
];

export default function OnboardingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: () => onboardingApi.listForms(),
    retry: false,
  });

  const forms = data?.data?.data ?? data?.data ?? mockForms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Onboarding Forms</h1>
          <p className="text-muted-foreground">Create and manage client onboarding forms</p>
        </div>
        <Button asChild>
          <Link href="/onboarding/new/builder"><Plus className="h-4 w-4 mr-1" /> Create Form</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {(Array.isArray(forms) ? forms : mockForms).map((form: typeof mockForms[0]) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{form.name}</CardTitle>
                    <Badge variant={form.status === "active" ? "success" : "secondary"}>{form.status}</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4 mt-1">
                    <span>{form.fields} fields</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{form.submissions} submissions</span>
                    <span>Updated {formatDate(form.updatedAt)}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/onboarding/${form.id}/builder`}>Edit</Link>
                  </Button>
                  <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

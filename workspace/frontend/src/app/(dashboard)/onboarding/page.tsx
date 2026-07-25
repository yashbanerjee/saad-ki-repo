"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { onboardingApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface OnboardingForm {
  id: string;
  name: string;
  fields?: number;
  submissions?: number;
  status: string;
  updatedAt: string;
}

export default function OnboardingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: () => onboardingApi.listForms(),
    retry: false,
  });

  const forms: OnboardingForm[] = data?.data?.data ?? data?.data ?? [];

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
      ) : forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No onboarding forms"
          description="Create a form to collect information from new clients."
          actionLabel="Create Form"
          actionHref="/onboarding/new/builder"
        />
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
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
                    <span>{form.fields ?? 0} fields</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{form.submissions ?? 0} submissions</span>
                    {form.updatedAt && <span>Updated {formatDate(form.updatedAt)}</span>}
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

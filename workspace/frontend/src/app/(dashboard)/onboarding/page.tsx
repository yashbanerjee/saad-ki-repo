"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Plus,
  ExternalLink,
  Users,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { onboardingApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface OnboardingForm {
  id: string;
  title?: string;
  name?: string;
  secureToken?: string;
  status: string;
  updatedAt: string;
  _count?: { fields?: number; submissions?: number };
  fields?: number;
  submissions?: number;
}

function clientLink(token?: string) {
  if (!token || typeof window === "undefined") return null;
  return `${window.location.origin}/onboarding/public/${token}`;
}

export default function OnboardingPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: () => onboardingApi.listForms(),
    retry: false,
  });

  const raw = data?.data?.data ?? data?.data ?? [];
  const forms: OnboardingForm[] = Array.isArray(raw) ? raw : [];

  const copyLink = async (form: OnboardingForm) => {
    const url = clientLink(form.secureToken);
    if (!url) {
      toast.error("Publish the form first to get a client link");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      toast.success("Client link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Onboarding Forms</h1>
          <p className="text-muted-foreground">
            Create forms and share a link with clients
          </p>
        </div>
        <Button asChild>
          <Link href="/onboarding/new/builder">
            <Plus className="h-4 w-4 mr-1" /> Create Form
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No onboarding forms"
          description="Create a form, save it, then copy the client link to share."
          actionLabel="Create Form"
          actionHref="/onboarding/new/builder"
        />
      ) : (
        <div className="space-y-3">
          {forms.map((form) => {
            const title = form.title || form.name || "Untitled form";
            const fieldCount = form._count?.fields ?? form.fields ?? 0;
            const submissionCount =
              form._count?.submissions ?? form.submissions ?? 0;
            const url = clientLink(form.secureToken);
            const published = form.status === "PUBLISHED";

            return (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{title}</CardTitle>
                      <Badge variant={published ? "success" : "secondary"}>
                        {form.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-4 mt-1">
                      <span>{fieldCount} fields</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {submissionCount} submissions
                      </span>
                      {form.updatedAt && (
                        <span>Updated {formatDate(form.updatedAt)}</span>
                      )}
                    </CardDescription>
                    {published && url && (
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        Client link: {url}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/onboarding/${form.id}/builder`}>Edit</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(form)}
                      disabled={!published}
                    >
                      {copiedId === form.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copy link
                    </Button>
                    {published && url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

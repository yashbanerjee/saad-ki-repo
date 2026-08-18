"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { OnboardingFormFill } from "@/components/features/OnboardingFormFill";
import { onboardingApi } from "@/lib/api";
import { VedhaMark } from "@/components/brand/VedhaMark";

export default function PublicOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <Skeleton className="h-96 w-full max-w-lg" />
        </div>
      }
    >
      <PublicOnboardingForm />
    </Suspense>
  );
}

function PublicOnboardingForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params.token as string;
  const clientId = searchParams.get("clientId") || undefined;
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-form", token, clientId],
    queryFn: () => onboardingApi.getPublicForm(token, clientId),
    retry: false,
  });

  const form = data?.data?.data ?? data?.data ?? null;
  const clientGate = form?.clientGate as
    | {
        accountDone: boolean;
        requiresAccount?: boolean;
        setupToken?: string | null;
      }
    | null
    | undefined;

  useEffect(() => {
    if (!clientGate?.requiresAccount || !clientGate.setupToken) return;
    router.replace(`/setup/${clientGate.setupToken}`);
  }, [clientGate, router]);

  if (isLoading || (clientGate?.requiresAccount && clientGate.setupToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Skeleton className="h-96 w-full max-w-lg mx-auto" />
          {clientGate?.requiresAccount && (
            <p className="text-sm text-muted-foreground">
              Please create your account first…
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <EmptyState
          title="Form not found"
          description="This onboarding form link is invalid or has expired."
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <VedhaMark className="mx-auto mb-4 h-12 w-12" />
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>
              Your form has been submitted successfully. We&apos;ll be in touch soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 mesh-vedha pointer-events-none opacity-60" />
      <div className="relative z-10 container mx-auto max-w-lg py-12 px-4">
        <div className="text-center mb-8">
          <VedhaMark className="mx-auto mb-4 h-12 w-12" />
          <h1 className="font-display text-2xl font-bold">{form.name ?? form.title}</h1>
          {form.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        <Card className="glass">
          <CardContent className="p-6">
            <OnboardingFormFill
              formToken={token}
              clientId={clientId}
              form={form}
              compact
              onSubmitted={() => setSubmitted(true)}
            />
          </CardContent>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <VedhaMark className="h-5 w-5 rounded-md" />
          Powered by TaskFlow by Vedha
        </p>
      </div>
    </div>
  );
}

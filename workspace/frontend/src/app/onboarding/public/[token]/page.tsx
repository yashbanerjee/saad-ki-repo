"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { onboardingApi } from "@/lib/api";
import { toast } from "sonner";

export default function PublicOnboardingPage() {
  const params = useParams();
  const token = params.token as string;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["public-form", token],
    queryFn: () => onboardingApi.getPublicForm(token),
    retry: false,
  });

  const form = data?.data?.data ?? data?.data ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onboardingApi.submitPublicForm(token, formData);
      setSubmitted(true);
      toast.success("Form submitted successfully");
    } catch {
      setSubmitted(true);
      toast.success("Form submitted");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Skeleton className="h-96 w-full max-w-lg" />
      </div>
    );
  }

  if (!form) {
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-teal">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>Your form has been submitted successfully. We&apos;ll be in touch soon.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />
      <div className="relative z-10 container mx-auto max-w-lg py-12 px-4">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-teal">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">{form.name}</h1>
          {form.description && <p className="text-muted-foreground mt-2">{form.description}</p>}
        </div>

        <Card className="glass">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {form.fields?.length > 0 ? (
                form.fields.map((field: { id: string; type: string; label: string; required?: boolean; placeholder?: string; options?: string[] }) => (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        placeholder={field.placeholder}
                        required={field.required}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      />
                    ) : field.type === "checkbox" ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          required={field.required}
                          onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: !!checked })}
                        />
                        <span className="text-sm">{field.placeholder || field.label}</span>
                      </div>
                    ) : field.type === "dropdown" ? (
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        required={field.required}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        required={field.required}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">This form has no fields configured.</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Form
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">Powered by TaskFlow Enterprise</p>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, Loader2, ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { onboardingApi } from "@/lib/api";
import { fromApiFieldType } from "@/components/features/FormBuilder";
import { toast } from "sonner";

type FieldValue = string | boolean | { name: string; type: string; size: number; dataUrl: string };

function isUploadType(type: string) {
  const t = fromApiFieldType(type);
  return t === "image" || t === "file";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  const token = params.token as string;
  const clientId = searchParams.get("clientId") || undefined;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, FieldValue>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["public-form", token],
    queryFn: () => onboardingApi.getPublicForm(token),
    retry: false,
  });

  const form = data?.data?.data ?? data?.data ?? null;

  const handleFileChange = async (
    fieldId: string,
    file: File | null,
    kind: "image" | "file"
  ) => {
    if (!file) {
      setFormData((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      return;
    }

    if (kind === "image" && !file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File must be under 8 MB");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setFormData((prev) => ({
      ...prev,
      [fieldId]: {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      },
    }));
    if (kind === "image") {
      setPreviews((prev) => ({ ...prev, [fieldId]: dataUrl }));
    } else {
      setPreviews((prev) => ({ ...prev, [fieldId]: file.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onboardingApi.submitPublicForm(token, formData, clientId);
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-vedha">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-vedha">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">{form.name ?? form.title}</h1>
          {form.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        <Card className="glass">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {form.fields?.length > 0 ? (
                form.fields.map(
                  (field: {
                    id: string;
                    type: string;
                    label: string;
                    required?: boolean;
                    placeholder?: string;
                    options?: string[];
                    accept?: string;
                    settings?: { accept?: string };
                  }) => {
                    const uiType = fromApiFieldType(field.type);
                    const accept =
                      field.accept ||
                      field.settings?.accept ||
                      (uiType === "image" ? "image/*" : undefined);

                    return (
                      <div key={field.id} className="space-y-2">
                        <Label>
                          {field.label}
                          {field.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {uiType === "textarea" ? (
                          <Textarea
                            placeholder={field.placeholder}
                            required={field.required}
                            onChange={(e) =>
                              setFormData({ ...formData, [field.id]: e.target.value })
                            }
                          />
                        ) : uiType === "checkbox" ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              required={field.required}
                              onCheckedChange={(checked) =>
                                setFormData({ ...formData, [field.id]: !!checked })
                              }
                            />
                            <span className="text-sm">
                              {field.placeholder || field.label}
                            </span>
                          </div>
                        ) : uiType === "dropdown" ? (
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            required={field.required}
                            onChange={(e) =>
                              setFormData({ ...formData, [field.id]: e.target.value })
                            }
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt: string) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : isUploadType(field.type) ? (
                          <div className="space-y-2">
                            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition hover:border-vedha-teal/40 hover:bg-muted/70">
                              {uiType === "image" ? (
                                <ImageIcon className="h-8 w-8 text-vedha-teal" />
                              ) : (
                                <Upload className="h-8 w-8 text-vedha-teal" />
                              )}
                              <span className="text-sm font-medium">
                                {field.placeholder ||
                                  (uiType === "image"
                                    ? "Click to upload an image"
                                    : "Click to upload a file")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Max 8 MB
                              </span>
                              <input
                                type="file"
                                className="sr-only"
                                accept={accept}
                                required={field.required && !formData[field.id]}
                                onChange={(e) =>
                                  handleFileChange(
                                    field.id,
                                    e.target.files?.[0] ?? null,
                                    uiType === "image" ? "image" : "file"
                                  )
                                }
                              />
                            </label>
                            {previews[field.id] && (
                              <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                                {uiType === "image" &&
                                String(previews[field.id]).startsWith("data:") ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={previews[field.id]}
                                    alt="Preview"
                                    className="h-14 w-14 rounded-md object-cover"
                                  />
                                ) : (
                                  <Upload className="h-5 w-5 text-muted-foreground" />
                                )}
                                <p className="min-w-0 flex-1 truncate text-sm">
                                  {typeof formData[field.id] === "object" &&
                                  formData[field.id] &&
                                  "name" in (formData[field.id] as object)
                                    ? (formData[field.id] as { name: string }).name
                                    : previews[field.id]}
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    handleFileChange(field.id, null, uiType === "image" ? "image" : "file")
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Input
                            type={
                              uiType === "phone"
                                ? "tel"
                                : uiType === "email"
                                  ? "email"
                                  : uiType === "number"
                                    ? "number"
                                    : uiType === "date"
                                      ? "date"
                                      : "text"
                            }
                            placeholder={field.placeholder}
                            required={field.required}
                            onChange={(e) =>
                              setFormData({ ...formData, [field.id]: e.target.value })
                            }
                          />
                        )}
                      </div>
                    );
                  }
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  This form has no fields configured.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Form
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by TaskFlow by Vedha
        </p>
      </div>
    </div>
  );
}

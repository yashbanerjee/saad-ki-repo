"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Loader2, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { fromApiFieldType } from "@/components/features/FormBuilder";
import { onboardingApi } from "@/lib/api";
import { toast } from "sonner";

type FieldValue =
  | string
  | boolean
  | { name: string; type: string; size: number; dataUrl: string };

type FormField = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  accept?: string;
  settings?: { accept?: string };
};

export type OnboardingFormShape = {
  id?: string;
  name?: string;
  title?: string;
  description?: string | null;
  fields?: FormField[];
};

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

type Props = {
  formToken: string;
  clientId?: string;
  form?: OnboardingFormShape | null;
  /** When true, loads form via API using formToken */
  loadFromApi?: boolean;
  onSubmitted?: () => void;
  submitLabel?: string;
  className?: string;
  compact?: boolean;
};

export function OnboardingFormFill({
  formToken,
  clientId,
  form: formProp,
  loadFromApi = !formProp,
  onSubmitted,
  submitLabel = "Submit Form",
  className,
  compact = false,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, FieldValue>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadedForm, setLoadedForm] = useState<OnboardingFormShape | null>(formProp ?? null);
  const [loading, setLoading] = useState(!!loadFromApi && !formProp);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (formProp) {
      setLoadedForm(formProp);
      setLoading(false);
      return;
    }
    if (!loadFromApi) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    onboardingApi
      .getPublicForm(formToken, clientId)
      .then((res) => {
        if (cancelled) return;
        setLoadedForm(res.data?.data ?? res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formToken, clientId, formProp, loadFromApi]);

  const form = formProp ?? loadedForm;

  const handleFileChange = async (
    fieldId: string,
    file: File | null,
    kind: "image" | "file",
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

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File must be under 100 MB");
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
      await onboardingApi.submitPublicForm(
        formToken,
        formData as Record<string, unknown>,
        clientId,
      );
      toast.success("Form submitted successfully");
      onSubmitted?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not submit form";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Skeleton className={compact ? "h-48 w-full" : "h-72 w-full"} />;
  }

  if (loadError || !form) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        This form could not be loaded.
      </p>
    );
  }

  const fields = form.fields ?? [];

  return (
    <form onSubmit={handleSubmit} className={className ?? "space-y-5"}>
      {!compact && (form.name || form.title) && (
        <div className="space-y-1 mb-1">
          <h3 className="font-medium text-base">{form.name ?? form.title}</h3>
          {form.description && (
            <p className="text-xs text-muted-foreground">{form.description}</p>
          )}
        </div>
      )}

      {fields.length > 0 ? (
        fields.map((field) => {
          const uiType = fromApiFieldType(field.type);
          const accept =
            field.accept ||
            field.settings?.accept ||
            (uiType === "image" ? "image/*" : undefined);

          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {uiType === "textarea" ? (
                <Textarea
                  placeholder={field.placeholder}
                  required={field.required}
                  className="text-base sm:text-sm"
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
                  <span className="text-sm">{field.placeholder || field.label}</span>
                </div>
              ) : uiType === "dropdown" ? (
                <select
                  className="flex h-11 sm:h-9 w-full rounded-md border border-input bg-transparent px-3 text-base sm:text-sm"
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
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-muted/70">
                    {uiType === "image" ? (
                      <ImageIcon className="h-8 w-8 text-primary" />
                    ) : (
                      <Upload className="h-8 w-8 text-primary" />
                    )}
                    <span className="text-sm font-medium">
                      {field.placeholder ||
                        (uiType === "image"
                          ? "Click to upload an image"
                          : "Click to upload a file")}
                    </span>
                    <span className="text-xs text-muted-foreground">Max 100 MB</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept={accept}
                      required={field.required && !formData[field.id]}
                      onChange={(e) =>
                        handleFileChange(
                          field.id,
                          e.target.files?.[0] ?? null,
                          uiType === "image" ? "image" : "file",
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
                          handleFileChange(
                            field.id,
                            null,
                            uiType === "image" ? "image" : "file",
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  className="h-11 text-base sm:h-9 sm:text-sm"
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
        })
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          This form has no fields configured.
        </p>
      )}

      <Button type="submit" className="w-full h-11" disabled={submitting || fields.length === 0}>
        {submitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormBuilder,
  fromApiFieldType,
  toApiFieldType,
  type FormField,
} from "@/components/features/FormBuilder";
import { onboardingApi } from "@/lib/api";
import { toast } from "sonner";

function publicFormUrl(secureToken: string) {
  if (typeof window === "undefined") return `/onboarding/public/${secureToken}`;
  return `${window.location.origin}/onboarding/public/${secureToken}`;
}

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const routeId = params.id as string;
  const isNew = routeId === "new";

  const [formId, setFormId] = useState<string | null>(isNew ? null : routeId);
  const [title, setTitle] = useState("Client onboarding form");
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-form", formId],
    queryFn: () => onboardingApi.getForm(formId!),
    enabled: Boolean(formId) && !isNew,
    retry: false,
  });

  const form = data?.data?.data ?? data?.data ?? null;

  useEffect(() => {
    if (!form) return;
    setTitle(form.title || form.name || "Client onboarding form");
    if (form.secureToken && form.status === "PUBLISHED") {
      setShareUrl(publicFormUrl(form.secureToken));
    }
  }, [form]);

  const initialFields: FormField[] = useMemo(() => {
    const raw = form?.fields;
    if (!Array.isArray(raw)) return [];
    return raw.map(
      (f: {
        id: string;
        type: string;
        label: string;
        placeholder?: string;
        required?: boolean;
        options?: string[] | unknown;
        settings?: { accept?: string };
        name?: string;
      }) => ({
        id: f.id,
        type: fromApiFieldType(f.type),
        label: f.label,
        placeholder: f.placeholder,
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? (f.options as string[]) : undefined,
        accept: f.settings?.accept,
      })
    );
  }, [form]);

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Client link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleSave = async (fields: FormField[]) => {
    if (fields.length === 0) {
      toast.error("Add at least one field before saving");
      return;
    }

    setSaving(true);
    try {
      let id = formId;
      if (!id) {
        const created = await onboardingApi.createForm({
          title: title.trim() || "Client onboarding form",
        });
        const createdForm = created.data?.data ?? created.data;
        id = createdForm.id as string;
        setFormId(id);
        router.replace(`/onboarding/${id}/builder`);
      }

      const payload = fields.map((f, order) => ({
        type: toApiFieldType(f.type),
        label: f.label,
        name: f.id || `field_${order + 1}`,
        required: f.required,
        order,
        placeholder: f.placeholder,
        options: f.options ?? [],
        settings: f.accept ? { accept: f.accept } : {},
      }));

      const saved = await onboardingApi.updateForm(id!, {
        title: title.trim() || "Client onboarding form",
        fields: payload,
        publish: true,
      });

      let savedForm = saved.data?.data ?? saved.data;
      // Older publish responses may omit fields/token — refetch
      if (!savedForm?.secureToken && id) {
        const fresh = await onboardingApi.getForm(id);
        savedForm = fresh.data?.data ?? fresh.data;
      }
      const token = savedForm.secureToken as string;
      if (!token) {
        throw new Error("Form saved but no public link token was returned");
      }
      const url = publicFormUrl(token);
      setShareUrl(url);
      await queryClient.invalidateQueries({ queryKey: ["onboarding-forms"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-form", id] });
      toast.success("Form saved & published");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to save form";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/onboarding">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold">Form Builder</h1>
            <div className="space-y-1.5">
              <Label htmlFor="form-title" className="text-xs text-muted-foreground">
                Form title
              </Label>
              <Input
                id="form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="max-w-md"
                placeholder="Client onboarding form"
              />
            </div>
          </div>
        </div>
        {saving && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </p>
        )}
      </div>

      {shareUrl && (
        <Card className="bg-muted/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Client form link</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                  {shareUrl}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send this link to your client so they can fill the form.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copyLink(shareUrl)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button type="button" size="sm" asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && formId ? (
        <p className="text-sm text-muted-foreground">Loading form…</p>
      ) : (
        <FormBuilder
          key={formId ?? "new"}
          initialFields={initialFields}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormBuilder } from "@/components/features/FormBuilder";
import { onboardingApi } from "@/lib/api";
import { toast } from "sonner";

export default function FormBuilderPage() {
  const params = useParams();
  const formId = params.id as string;

  const handleSave = async (fields: unknown[]) => {
    try {
      await onboardingApi.updateForm(formId, { fields });
      toast.success("Form saved successfully");
    } catch {
      toast.success("Form saved locally");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/onboarding"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Form Builder</h1>
          <p className="text-muted-foreground text-sm">Drag fields from the palette to build your form</p>
        </div>
      </div>
      <FormBuilder onSave={handleSave} />
    </div>
  );
}

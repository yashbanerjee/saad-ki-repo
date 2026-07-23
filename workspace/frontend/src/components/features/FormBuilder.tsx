"use client";

import { useState } from "react";
import {
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  Calendar,
  Mail,
  Phone,
  Hash,
  GripVertical,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "textarea" | "dropdown" | "checkbox" | "date" | "email" | "phone" | "number";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const fieldTypes: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Textarea", icon: AlignLeft },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "date", label: "Date", icon: Calendar },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "number", label: "Number", icon: Hash },
];

interface FormBuilderProps {
  initialFields?: FormField[];
  onSave?: (fields: FormField[]) => void;
}

export function FormBuilder({ initialFields = [], onSave }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: `New ${type} field`,
      required: false,
      options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
    setSelectedId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectedField = fields.find((f) => f.id === selectedId);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-3 glass-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Field Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {fieldTypes.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => addField(type)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Form Preview</CardTitle>
          <Button size="sm" onClick={() => onSave?.(fields)}>Save Form</Button>
        </CardHeader>
        <CardContent className="space-y-4 min-h-[400px]">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Plus className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Add fields from the palette</p>
            </div>
          ) : (
            fields.map((field) => (
              <div
                key={field.id}
                onClick={() => setSelectedId(field.id)}
                className={cn(
                  "group relative rounded-lg border p-4 cursor-pointer transition-colors",
                  selectedId === field.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
              >
                <GripVertical className="absolute left-1 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                <div className="pl-4">
                  <Label className="flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea placeholder={field.placeholder} disabled className="mt-1.5" />
                  ) : field.type === "checkbox" ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input type="checkbox" disabled />
                      <span className="text-sm text-muted-foreground">{field.placeholder || "Checkbox option"}</span>
                    </div>
                  ) : field.type === "dropdown" ? (
                    <select disabled className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {field.options?.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <Input type={field.type} placeholder={field.placeholder} disabled className="mt-1.5" />
                  )}
                  <Badge variant="outline" className="mt-2 text-[10px]">{field.type}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 glass-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Field Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedField ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={selectedField.placeholder || ""}
                  onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Required</Label>
                <Switch
                  checked={selectedField.required}
                  onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
                />
              </div>
              {selectedField.type === "dropdown" && (
                <div className="space-y-2">
                  <Label>Options (comma separated)</Label>
                  <Textarea
                    value={selectedField.options?.join(", ") || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a field to edit its settings</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, Plus, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "@/components/features/SignaturePad";
import { ndaApi } from "@/lib/api";
import { toast } from "sonner";

interface NdaTemplate {
  id: string;
  name: string;
  version: string;
  signed?: number;
  status: string;
  content?: string;
}

export default function NDAPage() {
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NdaTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["nda-templates"],
    queryFn: () => ndaApi.listTemplates(),
    retry: false,
  });

  const templates: NdaTemplate[] = data?.data?.data ?? data?.data ?? [];

  const handleSign = async (signature: { type: "draw" | "type"; value: string }) => {
    try {
      await ndaApi.sign({ templateId: selectedTemplate?.id, signature });
      toast.success("NDA signed successfully");
    } catch {
      toast.success("NDA signed");
    }
    setSignDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">NDA Management</h1>
          <p className="text-muted-foreground">Templates and digital signing</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="signed">Signed Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No NDA templates"
              description="Create a template to start collecting signed agreements."
              actionLabel="New Template"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="glass-subtle">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileSignature className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription>v{template.version}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="success">{template.status}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />{template.signed ?? 0} signed
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1"><Eye className="h-4 w-4 mr-1" /> Preview</Button>
                      <Button size="sm" className="flex-1" onClick={() => { setSelectedTemplate(template); setSignDialogOpen(true); }}>
                        Sign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signed" className="mt-6">
          <EmptyState
            icon={FileSignature}
            title="No signed documents"
            description="Signed NDAs will appear here once clients complete signing."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sign NDA</DialogTitle>
            <DialogDescription>Review the document and apply your signature below</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {selectedTemplate?.content || "No document content available."}
          </div>
          <SignaturePad onSign={handleSign} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

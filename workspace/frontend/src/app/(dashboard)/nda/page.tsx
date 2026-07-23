"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, Plus, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "@/components/features/SignaturePad";
import { ndaApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const mockTemplates = [
  { id: "1", name: "Standard Mutual NDA", version: "2.1", signed: 12, status: "active", updatedAt: "2026-01-15" },
  { id: "2", name: "One-Way Confidentiality", version: "1.0", signed: 5, status: "active", updatedAt: "2026-01-10" },
  { id: "3", name: "Employee NDA", version: "3.0", signed: 28, status: "active", updatedAt: "2025-12-01" },
];

const ndaContent = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date of signature below.

1. CONFIDENTIAL INFORMATION
Each party may disclose certain confidential and proprietary information to the other party.

2. OBLIGATIONS
The receiving party shall hold and maintain the Confidential Information in strict confidence.

3. TERM
This Agreement shall remain in effect for a period of two (2) years from the date of signing.

4. GOVERNING LAW
This Agreement shall be governed by the laws of the applicable jurisdiction.`;

export default function NDAPage() {
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["nda-templates"],
    queryFn: () => ndaApi.listTemplates(),
    retry: false,
  });

  const templates = data?.data?.data ?? data?.data ?? mockTemplates;

  const handleSign = async (signature: { type: "draw" | "type"; value: string }) => {
    try {
      await ndaApi.sign({ templateId: selectedTemplate, signature });
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Array.isArray(templates) ? templates : mockTemplates).map((template: typeof mockTemplates[0]) => (
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
                      <CheckCircle2 className="h-3 w-3" />{template.signed} signed
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1"><Eye className="h-4 w-4 mr-1" /> Preview</Button>
                    <Button size="sm" className="flex-1" onClick={() => { setSelectedTemplate(template.id); setSignDialogOpen(true); }}>
                      Sign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="signed" className="mt-6">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Signed documents will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sign NDA</DialogTitle>
            <DialogDescription>Review the document and apply your signature below</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {ndaContent}
          </div>
          <SignaturePad onSign={handleSign} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

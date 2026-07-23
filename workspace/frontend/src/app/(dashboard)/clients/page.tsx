"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { clientsApi } from "@/lib/api";
import { toast } from "sonner";

const mockClients = [
  { id: "1", name: "Acme Corp", contact: "John Doe", email: "john@acme.com", phone: "+1 555-0100", status: "active", projects: 3 },
  { id: "2", name: "TechStart Inc", contact: "Jane Smith", email: "jane@techstart.io", phone: "+1 555-0200", status: "active", projects: 1 },
  { id: "3", name: "Global Systems", contact: "Mike Chen", email: "mike@globalsys.com", phone: "+1 555-0300", status: "prospect", projects: 0 },
];

export default function ClientsPage() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list(),
    retry: false,
  });

  const clients = data?.data?.data ?? data?.data ?? mockClients;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage client relationships</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Company Name</Label><Input placeholder="Acme Corp" /></div>
              <div className="space-y-2"><Label>Contact Name</Label><Input placeholder="John Doe" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="john@acme.com" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { toast.success("Client added"); setOpen(false); }}>Add Client</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(clients) ? clients : mockClients).map((client: typeof mockClients[0]) => (
            <Card key={client.id} className="glass-subtle hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{client.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{client.contact}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{client.email}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{client.phone}</div>
                <div className="flex items-center justify-between pt-2">
                  <Badge variant={client.status === "active" ? "success" : "warning"}>{client.status}</Badge>
                  <span className="text-xs text-muted-foreground">{client.projects} projects</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

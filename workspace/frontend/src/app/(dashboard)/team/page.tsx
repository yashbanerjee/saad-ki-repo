"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Plus, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { teamApi } from "@/lib/api";
import { getInitials } from "@/lib/utils";

const mockTeam = [
  { id: "1", name: "Alex Morgan", email: "alex@company.com", role: "admin", status: "active", projects: 5 },
  { id: "2", name: "Sarah Kim", email: "sarah@company.com", role: "manager", status: "active", projects: 3 },
  { id: "3", name: "James Liu", email: "james@company.com", role: "member", status: "active", projects: 4 },
  { id: "4", name: "Emily Chen", email: "emily@company.com", role: "member", status: "active", projects: 2 },
  { id: "5", name: "Mike Johnson", email: "mike@client.com", role: "client", status: "active", projects: 1 },
];

const roleVariant = { admin: "destructive" as const, manager: "warning" as const, member: "info" as const, client: "secondary" as const };

export default function TeamPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => teamApi.list(),
    retry: false,
  });

  const team = data?.data?.data ?? data?.data ?? mockTeam;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">Manage team members and roles</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" /> Invite Member</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(Array.isArray(team) ? team : mockTeam).map((member: typeof mockTeam[0]) => (
                <div key={member.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</p>
                  </div>
                  <Badge variant={roleVariant[member.role as keyof typeof roleVariant]}>
                    <Shield className="h-3 w-3 mr-1" />{member.role}
                  </Badge>
                  <Badge variant="success">{member.status}</Badge>
                  <span className="text-xs text-muted-foreground hidden sm:block">{member.projects} projects</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

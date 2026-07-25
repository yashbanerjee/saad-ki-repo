"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Plus, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { teamApi } from "@/lib/api";
import { getInitials } from "@/lib/utils";

const roleVariant = { admin: "destructive" as const, manager: "warning" as const, member: "info" as const, client: "secondary" as const };

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  projects?: number;
}

export default function TeamPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => teamApi.list(),
    retry: false,
  });

  const team: TeamMember[] = data?.data?.data ?? data?.data ?? [];

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
      ) : team.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Invite colleagues to collaborate in your workspace."
          actionLabel="Invite Member"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {team.map((member) => (
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
                  <span className="text-xs text-muted-foreground hidden sm:block">{member.projects ?? 0} projects</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

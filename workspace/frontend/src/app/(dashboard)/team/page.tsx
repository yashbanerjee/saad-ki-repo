"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Plus, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-muted text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">{member.name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant[member.role as keyof typeof roleVariant]}>
                        <Shield className="h-3 w-3 mr-1" />
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="success">{member.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                      {member.projects ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

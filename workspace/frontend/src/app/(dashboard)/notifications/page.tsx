"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Bug, FolderKanban, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { notificationsApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

const typeIcons = { issue: Bug, project: FolderKanban, team: UserPlus };

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  time: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    retry: false,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const notifications: Notification[] = data?.data?.data ?? data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{unreadCount} unread</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up. New activity will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const Icon = typeIcons[notif.type as keyof typeof typeIcons] || Bell;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 px-6 py-4 transition-colors ${!notif.read ? "bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${!notif.read ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${!notif.read ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{notif.title}</p>
                        {!notif.read && <Badge variant="info" className="text-[10px]">New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(notif.time)}</p>
                    </div>
                    {!notif.read && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

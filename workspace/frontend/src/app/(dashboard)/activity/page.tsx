"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { activityApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

export default function ActivityPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", "all"],
    queryFn: () => activityApi.list({ page: 1, limit: 50 }),
    retry: false,
  });

  const raw = data?.data?.data ?? data?.data ?? [];
  const rows = Array.isArray(raw) ? raw : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Full workspace activity history
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-muted-foreground" /> All activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Failed to load activity
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Activity from your team will show up here."
              className="py-10"
            />
          ) : (
            <div className="space-y-4">
              {rows.map(
                (row: {
                  id: string;
                  action?: string;
                  message?: string;
                  target?: string;
                  user?:
                    | string
                    | { firstName?: string; lastName?: string; email?: string };
                  time?: string;
                  createdAt?: string;
                }) => {
                  const userName =
                    typeof row.user === "string"
                      ? row.user
                      : row.user
                        ? `${row.user.firstName || ""} ${row.user.lastName || ""}`.trim() ||
                          row.user.email ||
                          "System"
                        : "System";
                  const target = row.target || row.message || "Activity";
                  const time = row.time || row.createdAt || "";
                  return (
                    <div key={row.id} className="flex gap-3 text-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p>
                          <span className="font-medium">{userName}</span>{" "}
                          <span className="text-muted-foreground">
                            {String(row.action || "updated")
                              .toLowerCase()
                              .replace(/_/g, " ")}
                          </span>
                        </p>
                        <p className="truncate text-muted-foreground">{target}</p>
                        {time && (
                          <p className="mt-0.5 text-xs text-muted-foreground/70">
                            {formatRelativeTime(time)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

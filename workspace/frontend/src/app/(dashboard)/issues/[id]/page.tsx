"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bug, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { issuesApi } from "@/lib/api";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";

const mockIssue = {
  id: "1",
  title: "Login redirect loop on Safari",
  description: "Users on Safari 17+ experience an infinite redirect loop when attempting to log in via SSO. The issue occurs specifically when the session cookie is set with SameSite=Lax.",
  type: "bug",
  priority: "high",
  status: "open",
  assignee: "James L.",
  reporter: "Sarah K.",
  project: "Website Redesign",
  createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  comments: [
    { id: "1", author: "James L.", content: "Reproduced on Safari 17.2. Looks like a cookie SameSite issue.", createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "2", author: "Sarah K.", content: "Also seeing this on iOS Safari. Priority should be high.", createdAt: new Date(Date.now() - 7200000).toISOString() },
  ],
};

export default function IssueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.get(id),
    retry: false,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => issuesApi.addComment(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", id] });
      setComment("");
      toast.success("Comment added");
    },
    onError: () => toast.error("Failed to add comment"),
  });

  const issue = data?.data?.data ?? data?.data ?? { ...mockIssue, id };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/issues"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">#{issue.id}</span>
            <Badge variant="destructive">{issue.priority}</Badge>
            <Badge variant="info">{issue.status}</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold">{issue.title}</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{issue.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Comments ({issue.comments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {issue.comments?.map((c: { id: string; author: string; content: string; createdAt: string }) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(c.author)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.author}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-1">{c.content}</p>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex gap-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                size="sm"
                disabled={!comment.trim()}
                onClick={() => commentMutation.mutate(comment)}
              >
                <Send className="h-4 w-4 mr-1" /> Comment
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Assignee</span><span>{issue.assignee}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reporter</span><span>{issue.reporter}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span>{issue.project}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="outline">{issue.type}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatRelativeTime(issue.createdAt)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

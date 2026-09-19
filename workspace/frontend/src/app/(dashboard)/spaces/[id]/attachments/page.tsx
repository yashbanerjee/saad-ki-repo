"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Paperclip } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { spaceHref } from "@/lib/space-paths";

export default function SpaceAttachmentsStub() {
  const params = useParams();
  const id = params.id as string;
  return (
    <EmptyState
      icon={Paperclip}
      title="Attachments"
      description="Issue attachments stay on each work item. Space files live under Docs."
      actionLabel="Open Docs"
      actionHref={spaceHref(id, "docs")}
    />
  );
}

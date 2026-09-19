"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { CalendarRange } from "lucide-react";

export default function SpaceTimelineStub() {
  return (
    <EmptyState
      icon={CalendarRange}
      title="Timeline coming soon"
      description="Gantt-style timeline for this space will land here — same place as Jira Timeline."
    />
  );
}

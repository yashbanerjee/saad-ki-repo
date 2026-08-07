"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Backlog is retired — redirect to the single project board */
export default function ProjectBacklogRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/projects/${id}/board`);
  }, [id, router]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Sprints are represented as milestones — redirect to the project board */
export default function ProjectSprintsRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/projects/${id}/board`);
  }, [id, router]);

  return null;
}

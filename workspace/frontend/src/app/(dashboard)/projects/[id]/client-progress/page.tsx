"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Client progress merged into project hub — redirect */
export default function ClientProgressRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/projects/${id}`);
  }, [id, router]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/** /share/:token is a friendly alias — same public content as /portal/:token */
export default function ShareProjectPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  useEffect(() => {
    if (token) {
      router.replace(`/portal/${token}`);
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Skeleton className="h-40 w-full max-w-md" />
    </div>
  );
}

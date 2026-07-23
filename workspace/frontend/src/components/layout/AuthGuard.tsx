"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      router.replace("/login");
    } else if (accessToken) {
      document.cookie = `taskflow-auth-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [isAuthenticated, accessToken, router]);

  if (!isAuthenticated && !accessToken) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import {
  isClientUser,
  normalizeAuthUser,
  useAuthStore,
} from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

const STAFF_ONLY_PREFIXES = [
  "/dashboard",
  "/crm",
  "/leads",
  "/deals",
  "/contacts",
  "/organizations",
  "/clients",
  "/team",
  "/reports",
  "/admin",
  "/onboarding",
  "/nda",
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken, user, updateUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const refreshed = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated && !accessToken) {
      router.replace("/login");
    } else if (accessToken) {
      document.cookie = `taskflow-auth-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [hydrated, isAuthenticated, accessToken, router]);

  useEffect(() => {
    if (!hydrated || !accessToken || refreshed.current) return;
    refreshed.current = true;
    authApi
      .me()
      .then((res) => {
        const payload = res.data?.data ?? res.data;
        if (payload && typeof payload === "object") {
          updateUser(normalizeAuthUser(payload as Record<string, unknown>));
        }
      })
      .catch(() => {
        /* keep persisted user — interceptor handles refresh */
      });
  }, [hydrated, accessToken, updateUser]);

  useEffect(() => {
    if (!hydrated || !isClientUser(user)) return;
    const onStaffRoute = STAFF_ONLY_PREFIXES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (onStaffRoute) {
      router.replace("/client-portal");
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated || (!isAuthenticated && !accessToken)) {
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

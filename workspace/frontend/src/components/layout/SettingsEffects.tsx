"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { enableBrowserPush, listenForForegroundPush } from "@/lib/firebase-push";
import { useTheme } from "next-themes";

type SettingsPayload = {
  preferences?: {
    notifications?: { push?: boolean };
    compactSidebar?: boolean;
    theme?: "light" | "dark" | null;
  };
  firebaseWeb?: {
    apiKey: string;
    authDomain?: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId: string;
    appId: string;
    vapidKey: string;
  } | null;
};

function unwrap(res: { data?: unknown }) {
  const body = res.data as { data?: unknown } | undefined;
  return (body && typeof body === "object" && "data" in body && body.data
    ? body.data
    : res.data) as SettingsPayload;
}

export function SettingsEffects() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const { setTheme } = useTheme();
  const applied = useRef<string | null>(null);
  const registered = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => unwrap(await settingsApi.get()),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data || !userId || applied.current === userId) return;
    applied.current = userId;
    if (typeof data.preferences?.compactSidebar === "boolean") {
      setCollapsed(data.preferences.compactSidebar);
    }
    if (data.preferences?.theme === "light" || data.preferences?.theme === "dark") {
      setTheme(data.preferences.theme);
    }
  }, [data, setCollapsed, setTheme, userId]);

  useEffect(() => {
    if (!data?.firebaseWeb || !data.preferences?.notifications?.push) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const token = await enableBrowserPush(data.firebaseWeb!);
        if (cancelled || !token || registered.current === token) return;
        await settingsApi.registerPush(token);
        registered.current = token;
        unlisten = await listenForForegroundPush(data.firebaseWeb!, (payload) => {
          toast(payload.title || "TaskFlow", { description: payload.body });
        });
      } catch {
        /* permission denied or unsupported */
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [data]);

  return null;
}

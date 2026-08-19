"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntegrationsSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings?tab=integrations");
  }, [router]);
  return null;
}

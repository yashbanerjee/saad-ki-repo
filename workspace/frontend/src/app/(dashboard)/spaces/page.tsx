"use client";

import { Suspense } from "react";
import SpacesPageInner from "./spaces-page-client";

export default function SpacesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground">Loading spaces...</div>
      }
    >
      <SpacesPageInner />
    </Suspense>
  );
}

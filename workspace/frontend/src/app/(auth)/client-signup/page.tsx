import { Suspense } from "react";
import ClientSignupPage from "./client-signup-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-xl bg-muted" />}>
      <ClientSignupPage />
    </Suspense>
  );
}

import { Suspense } from "react";
import LoginPage from "./login-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-xl bg-muted" />}>
      <LoginPage />
    </Suspense>
  );
}

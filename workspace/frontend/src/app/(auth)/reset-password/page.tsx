import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-xl bg-muted" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

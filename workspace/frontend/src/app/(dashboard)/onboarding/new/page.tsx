import { redirect } from "next/navigation";

/** /onboarding/new → builder (avoids 404 and bogus API calls to /forms/new) */
export default function NewOnboardingRedirectPage() {
  redirect("/onboarding/new/builder");
}

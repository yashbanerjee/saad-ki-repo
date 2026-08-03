"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/features/SignaturePad";
import { OnboardingFormFill } from "@/components/features/OnboardingFormFill";
import { NdaDocumentPreview } from "@/components/features/NdaDocumentPreview";
import { authApi, setupApi } from "@/lib/api";
import { normalizeAuthUser, useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const accountSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim() || "";
    const phone = data.phone?.trim() || "";
    if (!email && !phone) {
      ctx.addIssue({
        code: "custom",
        message: "Enter email or mobile number (or both)",
        path: ["email"],
      });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email", path: ["email"] });
    }
    if (phone && phone.replace(/\D/g, "").length < 7) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid mobile number",
        path: ["phone"],
      });
    }
  });

type AccountForm = z.infer<typeof accountSchema>;

type SetupPayload = {
  clientId: string;
  clientName: string;
  companyName: string;
  emailHint?: string | null;
  phoneHint?: string | null;
  accountDone: boolean;
  forms: {
    assignmentId: string;
    formId: string;
    title: string;
    description?: string | null;
    status: string;
    secureToken: string;
    completed: boolean;
  }[];
  formsComplete: boolean;
  requireNda: boolean;
  ndaDone: boolean;
  ndaTemplate?: {
    id: string;
    title: string;
    content: string;
    version: string;
  } | null;
  setupComplete: boolean;
  currentStep: "account" | "forms" | "nda" | "done";
};

const STEPS = [
  { id: "account", label: "Account" },
  { id: "forms", label: "Forms" },
  { id: "nda", label: "NDA" },
  { id: "done", label: "Portal" },
] as const;

export default function ClientSetupPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [signing, setSigning] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["setup", token],
    queryFn: () => setupApi.get(token),
    retry: false,
    refetchOnWindowFocus: true,
  });

  const setup: SetupPayload | null = useMemo(() => {
    const raw = data?.data?.data ?? data?.data ?? null;
    return raw && typeof raw === "object" ? (raw as SetupPayload) : null;
  }, [data]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "" },
  });

  useEffect(() => {
    if (!setup) return;
    reset((prev) => ({
      ...prev,
      email: setup.emailHint || prev.email || "",
      phone: setup.phoneHint || prev.phone || "",
    }));
  }, [setup, reset]);

  const registerMutation = useMutation({
    mutationFn: (form: AccountForm) =>
      authApi.registerClient({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        password: form.password,
        setupToken: token,
      }),
    onSuccess: (res) => {
      const payload = res.data.data ?? res.data;
      const { user, accessToken, refreshToken } = payload;
      setAuth(normalizeAuthUser(user), accessToken, refreshToken);
      document.cookie = `taskflow-auth-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
      toast.success("Account created");
      queryClient.invalidateQueries({ queryKey: ["setup", token] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not create account";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const handleSignNda = async (signature: { type: "draw" | "type"; value: string }) => {
    setSigning(true);
    try {
      await setupApi.signNda(token, {
        signatureType: signature.type === "draw" ? "DRAW" : "TYPE",
        signatureData: signature.value,
      });
      toast.success("NDA signed");
      await queryClient.invalidateQueries({ queryKey: ["setup", token] });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not sign NDA";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/40">
        <Skeleton className="h-80 w-full max-w-lg" />
      </div>
    );
  }

  if (isError || !setup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Setup link unavailable</CardTitle>
            <CardDescription>
              This invite may be disabled or invalid. Ask your agency for a new link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibleSteps = setup.requireNda
    ? STEPS
    : STEPS.filter((s) => s.id !== "nda");

  const stepStatus = (id: (typeof STEPS)[number]["id"]) => {
    if (id === "account") return setup.accountDone;
    if (id === "forms") return setup.formsComplete;
    if (id === "nda") return !setup.requireNda || setup.ndaDone;
    return setup.setupComplete;
  };

  const currentStepIndex = Math.max(
    0,
    visibleSteps.findIndex((s) => s.id === setup.currentStep),
  );
  const progressPct = Math.round(
    ((visibleSteps.filter((s) => stepStatus(s.id)).length) / visibleSteps.length) * 100,
  );
  const pendingForms = setup.forms.filter((f) => !f.completed);
  const activeForm = pendingForms[0];
  const completedForms = setup.forms.filter((f) => f.completed);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-background to-muted/40">
      <div className="mx-auto w-full max-w-xl sm:max-w-2xl lg:max-w-3xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center space-y-3 mb-6 sm:mb-8">
          <div className="mx-auto flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl gradient-vedha glow-vedha">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">
              {setup.companyName}
            </p>
            <h1 className="font-display text-[1.6rem] leading-tight sm:text-3xl font-bold px-1">
              Welcome, {setup.clientName}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto px-2">
              Complete your setup — account, forms
              {setup.requireNda ? ", and NDA" : ""} — then open your portal.
            </p>
          </div>
        </header>

        {/* Mobile-friendly stepper: equal columns, never wraps awkwardly */}
        <nav aria-label="Setup progress" className="mb-5 sm:mb-7">
          <ol className="grid gap-0" style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}>
            {visibleSteps.map((step, i) => {
              const done = stepStatus(step.id);
              const current = setup.currentStep === step.id;
              const reached = done || current || i < currentStepIndex;
              return (
                <li key={step.id} className="relative flex flex-col items-center gap-1.5 min-w-0">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-[15px] right-1/2 h-0.5 w-full -translate-y-1/2",
                        reached || stepStatus(visibleSteps[i - 1].id)
                          ? "bg-primary/70"
                          : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-[1] flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && !done && "border-primary bg-primary/10 text-primary",
                      !done && !current && "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] sm:text-xs font-medium truncate max-w-full px-0.5",
                      current || done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(progressPct, currentStepIndex === 0 ? 8 : progressPct)}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground sm:hidden">
            Step {currentStepIndex + 1} of {visibleSteps.length}
            {visibleSteps[currentStepIndex]
              ? ` · ${visibleSteps[currentStepIndex].label}`
              : ""}
          </p>
        </nav>

        {setup.currentStep === "account" && (
          <Card className="shadow-float border-border/60 overflow-hidden">
            <CardHeader className="space-y-1.5 px-4 pt-5 pb-3 sm:px-6 sm:pt-6">
              <CardTitle className="text-lg sm:text-xl">Create your account</CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                Enter email, mobile, or both. You&apos;ll use either to sign in later.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit((v) => registerMutation.mutate(v))}>
              <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">First name</Label>
                    <Input
                      className="h-11 text-base sm:text-sm"
                      autoComplete="given-name"
                      {...register("firstName")}
                      placeholder="Your name"
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Last name</Label>
                    <Input
                      className="h-11 text-base sm:text-sm"
                      autoComplete="family-name"
                      {...register("lastName")}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Email</Label>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="h-11 text-base sm:text-sm"
                    placeholder={setup.emailHint || "you@email.com"}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Mobile number</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-11 text-base sm:text-sm"
                    placeholder={setup.phoneHint || "+971 50 000 0000"}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    At least one of email or mobile is required.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="h-11 text-base sm:text-sm"
                    placeholder="At least 8 characters"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="pt-1 space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-medium"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…
                      </>
                    ) : (
                      "Create account & continue"
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground pb-[env(safe-area-inset-bottom)]">
                    Already have an account?{" "}
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                      className="text-primary font-medium underline-offset-2 hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </CardContent>
            </form>
          </Card>
        )}

        {setup.currentStep === "forms" && (
          <Card className="shadow-float border-border/60 overflow-hidden">
            <CardHeader className="space-y-1.5 px-4 pt-5 pb-3 sm:px-6 sm:pt-6">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <ClipboardList className="h-5 w-5 shrink-0" />
                <span>Complete onboarding forms</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Fill out the form below
                {pendingForms.length > 1
                  ? ` (${pendingForms.length} remaining)`
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
              {!isAuthenticated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs sm:text-sm">
                  Sign in to continue, then finish your forms.{" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                    className="text-primary font-medium underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                </div>
              )}

              {completedForms.length > 0 && (
                <ul className="space-y-2">
                  {completedForms.map((form) => (
                    <li
                      key={form.assignmentId}
                      className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{form.title}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">Done</span>
                    </li>
                  ))}
                </ul>
              )}

              {setup.forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No forms assigned yet. Contact your agency, or refresh if they just assigned one.
                </p>
              ) : activeForm ? (
                <div className="rounded-xl border p-3.5 sm:p-4 space-y-3">
                  <div>
                    <p className="font-medium text-sm">{activeForm.title}</p>
                    {activeForm.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeForm.description}
                      </p>
                    )}
                  </div>
                  <OnboardingFormFill
                    key={activeForm.assignmentId}
                    formToken={activeForm.secureToken}
                    clientId={setup.clientId}
                    loadFromApi
                    compact
                    submitLabel={
                      pendingForms.length > 1
                        ? "Submit & continue"
                        : "Submit form"
                    }
                    onSubmitted={() => {
                      queryClient.invalidateQueries({ queryKey: ["setup", token] });
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  All forms submitted
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full h-11"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…
                  </>
                ) : (
                  "Refresh status"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {setup.currentStep === "nda" && (
          <Card className="shadow-float border-border/60 overflow-hidden sm:max-w-3xl sm:mx-auto w-full">
            <CardHeader className="space-y-1.5 px-4 pt-5 pb-2 sm:px-8 sm:pt-7">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <FileSignature className="h-5 w-5 shrink-0" />
                <span>Sign NDA</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Review the agreement below, then apply your signature
                {setup.ndaTemplate?.title
                  ? ` · ${setup.ndaTemplate.title}`
                  : ""}
                {setup.ndaTemplate?.version ? ` v${setup.ndaTemplate.version}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pb-5 sm:px-8 sm:pb-8">
              {!isAuthenticated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs sm:text-sm">
                  You must be signed in to sign the NDA.{" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                    className="text-primary font-medium underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                </div>
              )}

              <NdaDocumentPreview content={setup.ndaTemplate?.content || ""} />

              {isAuthenticated && setup.ndaTemplate && (
                <div
                  className={cn(
                    "space-y-2 w-full",
                    signing && "opacity-60 pointer-events-none",
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                    Your signature
                  </p>
                  <div className="rounded-xl border bg-muted/20 p-3 sm:p-5 w-full">
                    <SignaturePad onSign={handleSignNda} />
                  </div>
                </div>
              )}
              {!setup.ndaTemplate && (
                <p className="text-sm text-muted-foreground">
                  Your agency has not published an NDA template yet. Please ask them to enable one.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {setup.currentStep === "done" && (
          <Card className="shadow-float border-border/60 text-center overflow-hidden">
            <CardHeader className="px-4 pt-8 pb-3 sm:px-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">You&apos;re all set</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Setup is complete. Open your client portal to follow project progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-6 sm:px-6">
              <Button className="w-full h-11" onClick={() => router.push("/client-portal")}>
                Go to client portal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

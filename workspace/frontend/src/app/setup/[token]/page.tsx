"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignaturePad } from "@/components/features/SignaturePad";
import { authApi, setupApi } from "@/lib/api";
import { normalizeAuthUser, useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const accountSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    mode: z.enum(["email", "phone"]),
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "email") {
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        ctx.addIssue({ code: "custom", message: "Valid email required", path: ["email"] });
      }
    } else if (!data.phone || data.phone.replace(/\D/g, "").length < 7) {
      ctx.addIssue({
        code: "custom",
        message: "Valid mobile number required",
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
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { mode: "email", firstName: "", lastName: "", password: "" },
  });

  const mode = watch("mode");

  const registerMutation = useMutation({
    mutationFn: (form: AccountForm) =>
      authApi.registerClient({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        email: form.mode === "email" ? form.email : undefined,
        phone: form.mode === "phone" ? form.phone : undefined,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl gradient-vedha glow-vedha">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {setup.companyName}
          </p>
          <h1 className="font-display text-3xl font-bold">Welcome, {setup.clientName}</h1>
          <p className="text-muted-foreground text-sm">
            Complete your setup — account, forms
            {setup.requireNda ? ", and NDA" : ""} — then open your portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {visibleSteps.map((step, i) => {
            const done = stepStatus(step.id);
            const current = setup.currentStep === step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <Badge
                  variant={done ? "success" : current ? "default" : "secondary"}
                  className="gap-1"
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                  {step.label}
                </Badge>
              </div>
            );
          })}
        </div>

        {setup.currentStep === "account" && (
          <Card className="shadow-float">
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Use email or mobile. You&apos;ll use this to sign in later.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit((v) => registerMutation.mutate(v))}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First name</Label>
                    <Input {...register("firstName")} placeholder="Your name" />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input {...register("lastName")} placeholder="Optional" />
                  </div>
                </div>

                <Tabs
                  value={mode}
                  onValueChange={(v) => setValue("mode", v as "email" | "phone")}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">Email</TabsTrigger>
                    <TabsTrigger value="phone">Mobile</TabsTrigger>
                  </TabsList>
                </Tabs>

                {mode === "email" ? (
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder={setup.emailHint || "you@email.com"}
                      defaultValue={setup.emailHint || ""}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Mobile number</Label>
                    <Input
                      type="tel"
                      placeholder={setup.phoneHint || "+971 50 000 0000"}
                      defaultValue={setup.phoneHint || ""}
                      {...register("phone")}
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone.message}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
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

                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </form>
          </Card>
        )}

        {setup.currentStep === "forms" && (
          <Card className="shadow-float">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Complete onboarding forms
              </CardTitle>
              <CardDescription>
                Open each form, submit it, then refresh this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAuthenticated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  Sign in to continue, then finish your forms.{" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                </div>
              )}
              {setup.forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No forms assigned yet. Contact your agency, or refresh if they just assigned one.
                </p>
              ) : (
                setup.forms.map((form) => (
                  <div
                    key={form.assignmentId}
                    className={cn(
                      "rounded-lg border p-3 flex items-start justify-between gap-3",
                      form.completed && "bg-muted/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-2">
                        {form.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{form.title}</span>
                      </p>
                      {form.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                    </div>
                    {form.completed ? (
                      <Badge variant="success">Done</Badge>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`/onboarding/public/${form.secureToken}?clientId=${setup.clientId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))
              )}
              <Button
                variant="secondary"
                className="w-full"
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
          <Card className="shadow-float">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" /> Sign NDA
              </CardTitle>
              <CardDescription>
                {setup.ndaTemplate?.title || "Non-disclosure agreement"}
                {setup.ndaTemplate?.version ? ` · v${setup.ndaTemplate.version}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  You must be signed in to sign the NDA.{" "}
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/setup/${token}`)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                </div>
              )}
              <div className="rounded-lg border bg-muted/30 p-4 max-h-56 overflow-y-auto text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {setup.ndaTemplate?.content || "No NDA content available yet."}
              </div>
              {isAuthenticated && setup.ndaTemplate && (
                <div className={cn(signing && "opacity-60 pointer-events-none")}>
                  <SignaturePad onSign={handleSignNda} />
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
          <Card className="shadow-float text-center">
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <CardTitle>You&apos;re all set</CardTitle>
              <CardDescription>
                Setup is complete. Open your client portal to follow project progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => router.push("/client-portal")}>
                Go to client portal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

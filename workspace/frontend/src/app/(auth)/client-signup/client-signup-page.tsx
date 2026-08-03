"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authApi } from "@/lib/api";
import { normalizeAuthUser, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

const schema = z
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

type FormData = z.infer<typeof schema>;

export default function ClientSignupPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalToken = searchParams.get("portal") || undefined;
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { mode: "email", firstName: "", lastName: "", password: "" },
  });

  const mode = watch("mode");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.registerClient({
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        email: data.mode === "email" ? data.email : undefined,
        phone: data.mode === "phone" ? data.phone : undefined,
        password: data.password,
        portalToken,
      });
      const payload = res.data.data ?? res.data;
      const { user, accessToken, refreshToken } = payload;
      const normalized = normalizeAuthUser(user);
      setAuth(normalized, accessToken, refreshToken);
      document.cookie = `taskflow-auth-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
      toast.success("Account created");
      router.push(portalToken ? `/portal/${portalToken}` : "/client-portal");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not create account";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-float">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-vedha glow-vedha">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">Create client account</CardTitle>
        <CardDescription>
          Sign up with email or mobile — then log in anytime
          {portalToken ? " to follow your project" : ""}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
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
              <Input type="email" placeholder="you@email.com" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Mobile number</Label>
              <Input
                type="tel"
                placeholder="+971 50 000 0000"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="At least 8 characters" {...register("password")} />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

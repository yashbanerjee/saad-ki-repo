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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, authApi } from "@/lib/api";
import { isClientUser, normalizeAuthUser, useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const redirect = searchParams.get("redirect");

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.identifier.trim(), data.password);
      const payload = res.data.data ?? res.data;
      const { user, accessToken, refreshToken } = payload;
      let normalized = normalizeAuthUser(user);
      setAuth(normalized, accessToken, refreshToken);
      document.cookie = `taskflow-auth-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;

      if (!normalized.companyName) {
        try {
          const companyRes = await api.get("/companies/me");
          const company = companyRes.data.data ?? companyRes.data;
          if (company?.name) {
            normalized = { ...normalized, companyName: company.name };
            useAuthStore.getState().updateUser({ companyName: company.name });
          }
        } catch {
          /* ignore */
        }
      }

      toast.success("Welcome back!");
      const isClient = isClientUser(normalized);
      const dest =
        isClient && (!redirect || redirect === "/dashboard")
          ? "/client-portal"
          : redirect || (isClient ? "/client-portal" : "/dashboard");
      router.push(dest);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Invalid credentials");
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
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in with email or mobile number</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or mobile</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@company.com or +9715…"
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-xs text-destructive">{errors.identifier.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Client?{" "}
            <Link href="/client-signup" className="text-primary hover:underline">
              Create your account
            </Link>
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Company workspace?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register company
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-vedha-bg">
      <div className="relative hidden overflow-hidden lg:flex lg:w-[46%]">
        <div className="absolute inset-0 gradient-vedha opacity-90" />
        <div className="absolute inset-0 mesh-vedha" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">TaskFlow</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">by Vedha</p>
            </div>
          </Link>
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Quiet power for ambitious teams.
            </h1>
            <p className="text-lg text-white/80">
              Premium project delivery, client onboarding, and AI assistance —
              designed as part of the Vedha ecosystem.
            </p>
          </div>
          <p className="text-sm text-white/50">vedha.ae · Dubai</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

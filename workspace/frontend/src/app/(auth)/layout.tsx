import Link from "next/link";
import { VedhaMark } from "@/components/brand/VedhaMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden overflow-hidden lg:flex lg:w-[46%] bg-[#F4F3EE]">
        <div className="absolute inset-0 mesh-vedha" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-zinc-900">
          <Link href="/" className="flex items-center gap-3">
            <VedhaMark className="h-10 w-10" />
            <div>
              <p className="text-lg font-bold">TaskFlow</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">by Vedha</p>
            </div>
          </Link>
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Quiet power for ambitious teams.
            </h1>
            <p className="text-lg text-zinc-600">
              Premium project delivery, client onboarding, and AI assistance —
              designed as part of the Vedha ecosystem.
            </p>
          </div>
          <p className="text-sm text-zinc-400">vedha.ae · Dubai</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

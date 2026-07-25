"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Kanban,
  Shield,
  Users,
  BarChart3,
  FileSignature,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Kanban,
    title: "Intelligent boards",
    desc: "Glass Kanban with priority glow, avatars, and spring drag motion.",
  },
  {
    icon: Users,
    title: "Client portal",
    desc: "A premium client experience for projects, documents, and support.",
  },
  {
    icon: FileSignature,
    title: "Onboarding & NDA",
    desc: "Animated wizards, document vaults, and digital signatures.",
  },
  {
    icon: BarChart3,
    title: "Living analytics",
    desc: "Minimal charts in glass containers — clarity without clutter.",
  },
  {
    icon: Shield,
    title: "Enterprise trust",
    desc: "RBAC, audit trails, and security patterns built for agencies.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-vedha-bg text-foreground">
      <div className="pointer-events-none fixed inset-0 mesh-vedha" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,102,97,0.2),_transparent_55%)]" />

      <header className="relative z-10 border-b border-white/[0.06] bg-[#09090B]/60 backdrop-blur-[20px]">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-vedha-animated glow-vedha">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">TaskFlow</span>
              <p className="text-[10px] uppercase tracking-[0.16em] text-vedha-gold/80">
                by Vedha
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto px-4 pb-24 pt-20 lg:px-6 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <Badge variant="gold" className="mb-6">
                Vedha product ecosystem
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">
                Project delivery,{" "}
                <span className="text-gradient-vedha">elevated</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                A luxury enterprise workspace for agencies — onboarding, NDAs,
                issues, and AI assistance in one calm, cinematic interface.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start free trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Enter workspace</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground">
                {["No credit card", "14-day trial", "SOC 2 ready"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-vedha-cyan" />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-16 max-w-5xl"
            >
              <div className="glass-card overflow-hidden p-3 md:p-4">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-vedha-gold/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-vedha-cyan/80" />
                  <span className="ml-3 text-xs text-muted-foreground">
                    TaskFlow · Sprint board
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Todo", "In Progress", "Done"].map((col, i) => (
                    <div
                      key={col}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left"
                    >
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {col}
                      </p>
                      {[0, 1].map((n) => (
                        <div
                          key={n}
                          className="mb-2 rounded-xl border border-white/8 bg-[#111827]/80 p-3 last:mb-0"
                          style={{ opacity: 1 - i * 0.08 - n * 0.05 }}
                        >
                          <div className="mb-2 h-2 w-2/3 rounded-full bg-white/10" />
                          <div className="h-1.5 w-1/2 rounded-full bg-white/5" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-28 lg:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Designed like a product — not an admin panel
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Minimal whitespace, glass surfaces, Vedha gradients, and motion that
              feels intentional.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-6"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
                  <f.icon className="h-5 w-5 text-vedha-cyan" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-8 text-center text-sm text-muted-foreground">
        TaskFlow by{" "}
        <a
          href="https://vedha.ae/"
          target="_blank"
          rel="noreferrer"
          className="text-vedha-champagne hover:underline"
        >
          Vedha
        </a>{" "}
        · Dubai
      </footer>
    </div>
  );
}

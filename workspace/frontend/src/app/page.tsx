"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Kanban,
  Shield,
  Users,
  BarChart3,
  FileSignature,
  CheckCircle2,
  Zap,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VedhaMark } from "@/components/brand/VedhaMark";

const features = [
  {
    icon: Kanban,
    title: "Intelligent boards",
    desc: "Clear Kanban boards with priorities, assignees, and smooth drag-and-drop.",
  },
  {
    icon: Users,
    title: "Client portal",
    desc: "Give clients a polished space for projects, documents, and updates.",
  },
  {
    icon: FileSignature,
    title: "Onboarding & NDA",
    desc: "Collect client details, store docs, and capture signatures in one flow.",
  },
  {
    icon: BarChart3,
    title: "Live analytics",
    desc: "Velocity, status distribution, and delivery health at a glance.",
  },
  {
    icon: Shield,
    title: "Enterprise trust",
    desc: "Roles, permissions, and audit trails built for serious agencies.",
  },
  {
    icon: Zap,
    title: "AI co-pilot",
    desc: "Draft tasks, summarize issues, and plan sprints with Vedha AI.",
  },
];

const previewColumns = [
  {
    title: "Todo",
    cards: [
      { title: "Client kickoff pack", tag: "Onboarding", tone: "teal" },
      { title: "NDA template review", tag: "Legal", tone: "gold" },
    ],
  },
  {
    title: "In Progress",
    cards: [
      { title: "Sprint board polish", tag: "Product", tone: "teal" },
      { title: "Portal access invite", tag: "Client", tone: "gold" },
    ],
  },
  {
    title: "Done",
    cards: [
      { title: "Workspace provisioning", tag: "Ops", tone: "teal" },
      { title: "Brand theme tokens", tag: "Design", tone: "gold" },
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FBFCFD] text-slate-900">
      {/* Soft light atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(0,0,0,0.04),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_10%,rgba(229,255,0,0.12),transparent_50%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <header className="relative z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <VedhaMark className="h-10 w-10 rounded-2xl" />
            </motion.div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">TaskFlow</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                by Vedha
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              asChild
              className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="shadow-md shadow-black/10">
              <Link href="/register">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 lg:px-6 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-left"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                <Globe2 className="h-3.5 w-3.5" />
                Vedha product ecosystem
              </div>

              <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                Project delivery,{" "}
                <span className="text-zinc-900">
                  elevated
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                A clean enterprise workspace for agencies — client onboarding, NDAs,
                issues, and AI assistance in one bright, calm interface.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild className="shadow-lg shadow-black/10">
                  <Link href="/register">
                    Start free trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                >
                  <Link href="/login">Enter workspace</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                {["No credit card", "14-day trial", "Built for agencies"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-teal-200/40 via-transparent to-amber-200/40 blur-2xl" />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.1)] sm:p-5">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                    <span className="ml-2 text-xs font-medium text-slate-500">
                      TaskFlow · Sprint board
                    </span>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                    Live
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {previewColumns.map((col, colIdx) => (
                    <motion.div
                      key={col.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + colIdx * 0.08 }}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                    >
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {col.title}
                      </p>
                      <div className="space-y-2">
                        {col.cards.map((card) => (
                          <div
                            key={card.title}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
                          >
                            <p className="text-sm font-medium text-slate-800">{card.title}</p>
                            <span
                              className={
                                card.tone === "gold"
                                  ? "mt-2 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                                  : "mt-2 inline-flex rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700"
                              }
                            >
                              {card.tag}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Why agencies choose TaskFlow
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Bright, focused, and ready for client work
              </h2>
              <p className="mt-3 text-slate-600">
                Built for delivery teams who want clarity — not another dark dashboard
                that feels like an admin panel.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border border-slate-200 bg-[#FBFCFD] p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                    <f.icon className="h-5 w-5 text-zinc-800" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-50 px-6 py-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:px-12"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#E5FF00]/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-zinc-300/40 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Ready to run projects the Vedha way?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-600">
              Create your workspace in minutes. Invite your team, onboard clients, and
              deliver with confidence.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild className="shadow-lg shadow-black/10">
                <Link href="/register">
                  Create workspace <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-slate-300 bg-white/80 text-slate-800 hover:bg-white"
              >
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <VedhaMark className="mx-auto mb-3 h-8 w-8" />
        TaskFlow by{" "}
        <a
          href="https://vedha.ae/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-zinc-800 hover:underline"
        >
          Vedha
        </a>{" "}
        · Dubai
      </footer>
    </div>
  );
}

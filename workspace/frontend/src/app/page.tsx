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
  { icon: Kanban, title: "Kanban Boards", desc: "Visual workflow management with drag-and-drop task boards" },
  { icon: Users, title: "Client Portal", desc: "Dedicated workspace for client collaboration and transparency" },
  { icon: FileSignature, title: "NDA & Onboarding", desc: "Digital signatures and custom onboarding forms" },
  { icon: BarChart3, title: "Analytics", desc: "Real-time insights into project health and team velocity" },
  { icon: Shield, title: "Enterprise Security", desc: "Role-based access control and audit logging" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 glass">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-teal">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">TaskFlow</span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">Enterprise</Badge>
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto px-4 lg:px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="success" className="mb-4">Now in Enterprise Beta</Badge>
              <h1 className="font-display text-4xl lg:text-6xl font-bold tracking-tight mb-6">
                Project delivery,{" "}
                <span className="text-primary">reimagined</span> for enterprise teams
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                TaskFlow unifies project management, client onboarding, NDAs, and collaboration
                in one professional platform built for agencies and enterprise teams.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">Start free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign in to workspace</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {["No credit card required", "14-day free trial", "SOC 2 ready"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="glass rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["Todo", "In Progress", "Done"].map((col, i) => (
                    <div key={col} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{col}</p>
                      {[1, 2].slice(0, 3 - i).map((n) => (
                        <div key={n} className="mb-2 rounded-md bg-card p-2 shadow-sm border border-border/50">
                          <div className="h-2 w-3/4 rounded bg-muted mb-1.5" />
                          <div className="h-1.5 w-1/2 rounded bg-muted/70" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Website Redesign</span>
                  <Badge variant="info">Sprint 4</Badge>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 glass rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Velocity</p>
                    <p className="text-lg font-bold text-primary">+24%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-muted/30 py-20">
          <div className="container mx-auto px-4 lg:px-6">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl font-bold mb-3">Everything your team needs</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From sprint planning to client onboarding — one platform for the entire project lifecycle.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="glass rounded-xl p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="container mx-auto px-4 lg:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TaskFlow Enterprise. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

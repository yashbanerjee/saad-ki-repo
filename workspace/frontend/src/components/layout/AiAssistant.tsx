"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  ListTodo,
  FileSearch,
  Bug,
  BarChart3,
  CalendarRange,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const quickActions = [
  { icon: ListTodo, label: "Generate tasks" },
  { icon: FileSearch, label: "Summarize issue" },
  { icon: Bug, label: "Explain bug" },
  { icon: BarChart3, label: "Generate report" },
  { icon: CalendarRange, label: "Create sprint" },
  { icon: MessageSquare, label: "Client support" },
];

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Hi — I'm your Vedha AI co-pilot. Ask me to generate tasks, summarize issues, or plan a sprint.",
    },
  ]);

  const send = () => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    setMessages((m) => [
      ...m,
      { role: "user", text: userMsg },
      {
        role: "assistant",
        text: "Got it. AI orchestration is ready — connect your model endpoint to unlock live generation.",
      },
    ]);
    setMessage("");
  };

  return (
    <>
      <motion.button
        type="button"
        aria-label="Open AI assistant"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl",
          "btn-gradient glow-vedha shadow-float",
          open && "pointer-events-none opacity-0"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ y: { repeat: Infinity, duration: 3, ease: "easeInOut" } }}
      >
        <Sparkles className="h-6 w-6 text-white dark:text-zinc-950" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border glass shadow-float"
            role="dialog"
            aria-label="AI Assistant"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0a0a0a]">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Vedha AI</p>
                  <p className="text-[11px] text-muted-foreground">Always on · Workspace aware</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => setMessage(a.label)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-vedha-teal/30 hover:text-foreground dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-vedha-cyan/30"
                >
                  <a.icon className="h-3 w-3" />
                  {a.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "assistant"
                      ? "bg-muted border border-border text-foreground dark:bg-white/[0.05] dark:border-white/8"
                      : "ml-auto bg-vedha-teal/20 border border-vedha-teal/40 text-foreground dark:bg-vedha-teal/30 dark:text-white"
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask Vedha AI…"
                  className="h-10"
                  aria-label="AI message"
                />
                <Button size="icon" onClick={send} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

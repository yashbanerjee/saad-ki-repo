"use client";

import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
  maxHeightClassName?: string;
};

/** Paper-style NDA document preview for mobile and desktop. */
export function NdaDocumentPreview({
  content,
  className,
  maxHeightClassName = "max-h-[min(50vh,26rem)] sm:max-h-[min(62vh,36rem)] lg:max-h-[min(68vh,42rem)]",
}: Props) {
  const blocks = normalizeNdaBlocks(content);

  if (!content?.trim()) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No NDA content available yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Desk / surface behind the page
        "rounded-xl sm:rounded-2xl overflow-hidden",
        "bg-gradient-to-b from-stone-200/80 via-stone-100/90 to-stone-200/70",
        "dark:from-stone-800/60 dark:via-stone-900/40 dark:to-stone-800/50",
        "border border-stone-300/60 dark:border-stone-700/60",
        "p-3 sm:p-5 lg:p-7",
        className,
      )}
    >
      <div className={cn("overflow-y-auto overscroll-contain", maxHeightClassName)}>
        {/* Paper page */}
        <article
          className={cn(
            "mx-auto bg-[#fffcf7] dark:bg-stone-950 text-stone-900 dark:text-stone-100",
            "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_28px_rgba(0,0,0,0.12)]",
            "border border-stone-300/70 dark:border-stone-700",
            "w-full max-w-[720px]",
            "px-5 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-12",
            "min-h-[280px] sm:min-h-[420px]",
          )}
        >
          {/* Top rule like letterhead */}
          <div className="mb-6 sm:mb-8 flex flex-col items-center gap-2">
            <div className="h-px w-16 bg-stone-400/80" />
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-stone-500">
              Confidential legal agreement
            </p>
          </div>

          <div className="space-y-4 sm:space-y-5 text-[13.5px] sm:text-[15px] leading-[1.7] sm:leading-[1.75] [font-family:Georgia,'Times_New_Roman',Times,serif]">
            {blocks.map((block, i) => {
              if (block.type === "title") {
                return (
                  <header key={i} className="text-center space-y-3 pb-2 sm:pb-4">
                    <h2 className="font-display text-[1.15rem] sm:text-2xl font-semibold tracking-[0.06em] uppercase text-stone-900 dark:text-stone-50">
                      {block.text}
                    </h2>
                    <div className="mx-auto h-px w-24 bg-stone-400/70" />
                  </header>
                );
              }

              if (block.type === "party") {
                return (
                  <div key={i} className="text-center space-y-1 py-1">
                    {block.eyebrow && (
                      <p className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-stone-500">
                        {block.eyebrow}
                      </p>
                    )}
                    <p className="font-semibold text-[15px] sm:text-base text-stone-900 dark:text-stone-50">
                      {block.name}
                    </p>
                    {block.role && (
                      <p className="text-sm italic text-stone-600 dark:text-stone-400">
                        {block.role}
                      </p>
                    )}
                  </div>
                );
              }

              if (block.type === "section") {
                return (
                  <div key={i} className="space-y-1.5 pt-1">
                    <h3 className="font-semibold text-stone-900 dark:text-stone-50 tracking-wide">
                      {block.heading}
                    </h3>
                    {block.body && (
                      <p className="whitespace-pre-wrap break-words text-stone-700 dark:text-stone-300">
                        {block.body}
                      </p>
                    )}
                  </div>
                );
              }

              if (block.type === "rule") {
                return (
                  <div key={i} className="py-3 sm:py-4">
                    <div className="h-px w-full bg-stone-300 dark:bg-stone-700" />
                  </div>
                );
              }

              if (block.type === "signature") {
                return (
                  <div
                    key={i}
                    className="mt-2 grid gap-1 border-b border-stone-400/80 dark:border-stone-600 pb-2 pt-3"
                  >
                    {block.label && (
                      <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                        {block.label}
                      </p>
                    )}
                    <p className="font-semibold text-base sm:text-lg text-stone-900 dark:text-stone-50 py-1">
                      {block.value}
                    </p>
                    {block.meta && (
                      <p className="text-xs sm:text-sm text-stone-500">{block.meta}</p>
                    )}
                  </div>
                );
              }

              return (
                <p
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap break-words text-stone-700 dark:text-stone-300",
                    block.align === "center" && "text-center",
                    block.emphasis && "font-medium text-stone-900 dark:text-stone-100",
                  )}
                >
                  {block.text}
                </p>
              );
            })}
          </div>

          <div className="mt-8 sm:mt-10 flex justify-center">
            <div className="h-px w-12 bg-stone-300" />
          </div>
        </article>
      </div>
    </div>
  );
}

type Block =
  | { type: "title"; text: string }
  | { type: "paragraph"; text: string; emphasis?: boolean; align?: "center" | "left" }
  | { type: "party"; eyebrow?: string; name: string; role?: string }
  | { type: "section"; heading: string; body?: string }
  | { type: "rule" }
  | { type: "signature"; label?: string; value: string; meta?: string };

function normalizeNdaBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let titleDone = false;

  const flush = (opts?: { align?: "center" | "left"; emphasis?: boolean }) => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    blocks.push({
      type: "paragraph",
      text,
      align: opts?.align,
      emphasis: opts?.emphasis,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (/^[─_\-=]{6,}$/.test(line)) {
      flush();
      const next = lines[i + 1]?.trim() || "";
      const sig = parseSignatureLine(next);
      if (sig) {
        i += 1;
        let meta: string | undefined;
        const maybeDate = lines[i + 1]?.trim() || "";
        if (/^date\s*:/i.test(maybeDate)) {
          meta = maybeDate;
          i += 1;
        }
        blocks.push({
          type: "signature",
          label: sig.label,
          value: sig.value,
          meta,
        });
      } else {
        blocks.push({ type: "rule" });
      }
      continue;
    }

    const sigInline = parseSignatureLine(line);
    if (
      sigInline &&
      /company|client\s*signature|receiving\s*party|disclosing\s*party/i.test(
        sigInline.label || "",
      )
    ) {
      flush();
      let meta: string | undefined;
      const maybeDate = lines[i + 1]?.trim() || "";
      if (/^date\s*:/i.test(maybeDate)) {
        meta = maybeDate;
        i += 1;
      }
      blocks.push({
        type: "signature",
        label: sigInline.label,
        value: sigInline.value,
        meta,
      });
      continue;
    }

    // Numbered section: "1. Purpose" or "1) Purpose"
    const sectionMatch = line.match(/^(\d+[.)]\s+.+)$/);
    if (sectionMatch && line.length < 100) {
      flush();
      const heading = sectionMatch[1];
      const bodyLines: string[] = [];
      while (i + 1 < lines.length) {
        const peek = lines[i + 1];
        const peekTrim = peek.trim();
        if (
          !peekTrim ||
          /^\d+[.)]\s+/.test(peekTrim) ||
          /^[─_\-=]{6,}$/.test(peekTrim) ||
          /^(IN WITNESS|BETWEEN|AND)\b/i.test(peekTrim)
        ) {
          break;
        }
        bodyLines.push(peekTrim);
        i += 1;
      }
      blocks.push({
        type: "section",
        heading,
        body: bodyLines.join(" ").trim() || undefined,
      });
      continue;
    }

    // BETWEEN / AND party blocks
    if (/^BETWEEN$/i.test(line) || /^AND$/i.test(line)) {
      flush();
      const eyebrow = line.toUpperCase();
      let name = "";
      let role = "";
      if (i + 1 < lines.length && lines[i + 1].trim()) {
        i += 1;
        const partyLine = lines[i].trim();
        const roleMatch = partyLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (roleMatch) {
          name = roleMatch[1].trim().replace(/^"|"$/g, "");
          role = `(${roleMatch[2]})`;
        } else {
          name = partyLine.replace(/^"|"$/g, "");
        }
      }
      blocks.push({ type: "party", eyebrow, name: name || eyebrow, role });
      continue;
    }

    if (!line) {
      flush();
      continue;
    }

    if (
      !titleDone &&
      blocks.length === 0 &&
      buffer.length === 0 &&
      line === line.toUpperCase() &&
      line.length < 80 &&
      /[A-Z]/.test(line)
    ) {
      blocks.push({ type: "title", text: line });
      titleDone = true;
      continue;
    }

    if (/^IN WITNESS WHEREOF/i.test(line)) {
      flush();
      blocks.push({ type: "rule" });
      blocks.push({
        type: "paragraph",
        text: line,
        emphasis: true,
        align: "left",
      });
      continue;
    }

    buffer.push(raw.replace(/\s+$/, ""));
  }
  flush();

  return blocks;
}

function parseSignatureLine(line: string): { label: string; value: string } | null {
  const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

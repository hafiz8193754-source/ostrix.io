"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ScreenshotAnalysis } from "@/types";

// Shows the screenshot analysis results in a collapsible panel below a
// rebuilt site card. Builds user trust by showing what Ostrix detected and
// what it improved, rather than just handing back a black-box result.
interface AnalysisPanelProps {
  analysis: ScreenshotAnalysis;
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-2xl self-start rounded-xl border border-border bg-bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        What Ostrix analyzed
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
              {!!analysis.color_palette?.length && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Color palette</p>
                  <div className="flex flex-wrap gap-3">
                    {analysis.color_palette.map((hex) => (
                      <div key={hex} className="flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: hex }} />
                        <span className="text-[11px] text-text-secondary">{hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!analysis.sections?.length && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Detected sections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.sections.map((s) => (
                      <span key={s} className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] text-text-secondary">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!!analysis.improvements_needed?.length && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Improvements applied</p>
                  <ul className="flex flex-col gap-1.5">
                    {analysis.improvements_needed.map((imp) => (
                      <li key={imp} className="flex items-start gap-2 text-xs text-text-secondary">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.overall_aesthetic && (
                <p className="border-l-2 border-border pl-3 text-xs italic text-text-muted">{analysis.overall_aesthetic}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

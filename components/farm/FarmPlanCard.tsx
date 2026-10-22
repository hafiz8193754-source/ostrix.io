"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Download, Sprout } from "lucide-react";

import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import type { FarmMeta, FarmPlan } from "@/types";

interface FarmPlanCardProps {
  plan: FarmPlan;
  meta: FarmMeta;
}

function downloadPlan(plan: FarmPlan, meta: FarmMeta) {
  const cp = plan.cost_projection;
  const lines = [
    `${BRAND.name} — Season Farm Plan`,
    `District: ${meta.district} | Land: ${meta.land}`,
    "",
    "1. CROP RECOMMENDATION",
    `${plan.crop_recommendation.crop} — ${plan.crop_recommendation.variety}`,
    plan.crop_recommendation.reasoning,
    `Sowing window: ${plan.crop_recommendation.sowing_window}`,
    "",
    ...(plan.diagnosis
      ? [
          "2. DIAGNOSIS",
          `Likely issue: ${plan.diagnosis.likely_issue}`,
          `Confidence: ${plan.diagnosis.confidence}`,
          `Treatment: ${plan.diagnosis.treatment}`,
          plan.diagnosis.advice,
          "",
        ]
      : []),
    "3. SEASON PLAN",
    ...(plan.season_plan || []).map((m) => `${m.label}: ${m.details}`),
    "",
    "4. COST & REVENUE PROJECTION",
    ...(cp.costs || []).map((c) => `- ${c.item}: ${c.per_acre_pkr} per acre (total ${c.total_pkr})`),
    `Total investment: ${cp.total_investment_pkr}`,
    `Expected yield: ${cp.expected_yield_maunds_per_acre} maunds/acre`,
    `Market rate: ${cp.market_rate_pkr_per_maund} per maund (source: ${cp.market_rate_source}, as of ${cp.market_rate_date})`,
    `Gross revenue: ${cp.gross_revenue_pkr}`,
    `Net profit: ${cp.net_profit_pkr} (${cp.profit_per_acre_pkr} per acre)`,
    cp.price_caveat,
    "",
    "NOTE: " + (plan.honesty_note || ""),
    "This is AI decision support. Confirm quantities and diagnosis with your local agriculture extension office before large purchases.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${BRAND.name.toLowerCase()}-farm-plan.txt`;
  a.click();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">{title}</h4>
      {children}
    </section>
  );
}

export function FarmPlanCard({ plan, meta }: FarmPlanCardProps) {
  const cp = plan.cost_projection;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl self-start overflow-hidden rounded-xl border border-border bg-bg-surface"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">Season plan — {meta.district}</p>
          <p className="truncate text-xs text-text-muted">{meta.land}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => downloadPlan(plan, meta)}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4 text-sm">
        <Section title="1 · Crop recommendation">
          <div className="flex items-start gap-2.5 rounded-lg bg-bg-elevated p-3">
            <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div>
              <p className="font-medium text-text-primary">
                {plan.crop_recommendation.crop} — {plan.crop_recommendation.variety}
              </p>
              <p className="mt-1 leading-relaxed text-text-secondary">{plan.crop_recommendation.reasoning}</p>
              <p className="mt-1 text-xs text-text-muted">Sowing window: {plan.crop_recommendation.sowing_window}</p>
            </div>
          </div>
        </Section>

        {plan.diagnosis && (
          <Section title="2 · Diagnosis">
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="font-medium text-text-primary">{plan.diagnosis.likely_issue}</p>
              <p className="text-xs text-text-muted">Confidence: {plan.diagnosis.confidence}</p>
              <p className="leading-relaxed text-text-secondary">{plan.diagnosis.treatment}</p>
              <p className="text-xs italic text-text-muted">{plan.diagnosis.advice}</p>
            </div>
          </Section>
        )}

        <Section title="3 · Season plan">
          <div className="flex flex-col gap-2">
            {(plan.season_plan || []).map((m, i) => (
              <div key={i} className="rounded-lg bg-bg-elevated p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{m.label}</p>
                <p className="mt-1 leading-relaxed text-text-primary">{m.details}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="4 · Cost & revenue projection">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="py-1.5 pr-3 font-medium">Item</th>
                  <th className="py-1.5 pr-3 font-medium">Per acre</th>
                  <th className="py-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(cp.costs || []).map((c, i) => (
                  <tr key={i} className="border-b border-border-subtle align-top">
                    <td className="py-1.5 pr-3 font-medium text-text-primary">{c.item}</td>
                    <td className="py-1.5 pr-3 text-text-secondary">{c.per_acre_pkr}</td>
                    <td className="py-1.5 text-text-secondary">{c.total_pkr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <div className="min-w-[140px] flex-1 rounded-md bg-bg-elevated p-3">
              <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Total investment</p>
              <p className="text-sm font-semibold text-text-primary">{cp.total_investment_pkr}</p>
            </div>
            <div className="min-w-[140px] flex-1 rounded-md bg-bg-elevated p-3">
              <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Expected yield</p>
              <p className="text-sm font-semibold text-text-primary">{cp.expected_yield_maunds_per_acre} maunds/acre</p>
            </div>
            <div className="min-w-[140px] flex-1 rounded-md bg-bg-elevated p-3">
              <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Gross revenue</p>
              <p className="text-sm font-semibold text-text-primary">{cp.gross_revenue_pkr}</p>
            </div>
            <div className="min-w-[140px] flex-1 rounded-md bg-bg-elevated p-3">
              <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Net profit</p>
              <p className="text-sm font-semibold text-text-primary">{cp.net_profit_pkr}</p>
              <p className="text-[11px] text-text-muted">{cp.profit_per_acre_pkr} per acre</p>
            </div>
          </div>

          <p className="mt-2 text-xs text-text-muted">
            Market rate: {cp.market_rate_pkr_per_maund}/maund — {cp.market_rate_source}, as of {cp.market_rate_date}. {cp.price_caveat}
          </p>
        </Section>

        <div className="flex gap-2 rounded-md border border-border bg-bg-elevated p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            {plan.honesty_note} This is AI decision support from the details you gave and current web-searched prices — confirm
            quantities and any diagnosis with your local agriculture extension office before buying inputs.
          </span>
        </div>
      </div>
    </motion.div>
  );
}

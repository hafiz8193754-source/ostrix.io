"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GenerationStatus } from "@/types";
import type { DetailEntry, ProgressContext, StepDef } from "@/lib/progressSteps";

const DETAIL_CYCLE_MS = 2500;
const CASCADE_STEP_MS = 200;
const OVERRUN_SUFFIX = " Taking a bit longer than usual...";

function resolveDetail(entry: DetailEntry, ctx: ProgressContext): string {
  return typeof entry === "function" ? entry(ctx) : entry;
}

function randomSeconds(seconds: number | [number, number]): number {
  return Array.isArray(seconds) ? seconds[0] + Math.random() * (seconds[1] - seconds[0]) : seconds;
}

function idleStatus(): GenerationStatus {
  return {
    isActive: false,
    steps: [],
    currentDetail: "",
    elapsedSeconds: 0,
    estimatedTotalSeconds: 0,
    failed: false,
    errorMessage: null,
  };
}

// Generic simulated-progress engine shared by builder/farm generation, refine,
// and deploy. Every step but the last auto-advances on its own timer; the
// last step holds indefinitely (looping its detail messages, flagging an
// overrun message once it runs past its nominal duration) until the caller's
// real async operation resolves and calls complete() or fail(). This is the
// one rule that guarantees the simulation never claims "done" before reality
// does, for any of the four flows that use this hook.
export function useStepProgress() {
  const [status, setStatus] = useState<GenerationStatus>(idleStatus);

  const stepsRef = useRef<StepDef[]>([]);
  const ctxRef = useRef<ProgressContext>({});
  const activeIndexRef = useRef(0);
  const stepStartRef = useRef(0);
  const detailIndexRef = useRef(0);

  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascadeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    if (detailIntervalRef.current) clearInterval(detailIntervalRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    cascadeTimeoutsRef.current.forEach(clearTimeout);
    cascadeTimeoutsRef.current = [];
    advanceTimeoutRef.current = null;
    detailIntervalRef.current = null;
    elapsedIntervalRef.current = null;
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  function activateStep(index: number) {
    activeIndexRef.current = index;
    stepStartRef.current = Date.now();
    detailIndexRef.current = 0;

    const def = stepsRef.current[index];
    const isLast = index === stepsRef.current.length - 1;
    const duration = randomSeconds(def.seconds);

    setStatus((s) => ({
      ...s,
      steps: s.steps.map((step, i) => (i === index ? { ...step, status: "active" } : step)),
      currentDetail: resolveDetail(def.details[0], ctxRef.current),
    }));

    if (detailIntervalRef.current) clearInterval(detailIntervalRef.current);
    detailIntervalRef.current = setInterval(() => {
      const currentDef = stepsRef.current[activeIndexRef.current];
      if (!currentDef) return;
      detailIndexRef.current = (detailIndexRef.current + 1) % currentDef.details.length;
      const elapsedOnStep = (Date.now() - stepStartRef.current) / 1000;
      const overrun = isLast && elapsedOnStep > duration;
      const base = resolveDetail(currentDef.details[detailIndexRef.current], ctxRef.current);
      setStatus((s) => ({ ...s, currentDetail: overrun ? `${base}${OVERRUN_SUFFIX}` : base }));
    }, DETAIL_CYCLE_MS);

    if (!isLast) {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = setTimeout(() => {
        setStatus((s) => ({
          ...s,
          steps: s.steps.map((step, i) =>
            i === index ? { ...step, status: "completed", duration: Math.round(duration) } : step
          ),
        }));
        activateStep(index + 1);
      }, duration * 1000);
    }
    // Last step: no auto-advance timeout — holds until complete()/fail().
  }

  const start = useCallback(
    (stepDefs: StepDef[], estimatedTotalSeconds: number, ctx: ProgressContext = {}) => {
      clearAllTimers();
      const included = stepDefs.filter((d) => !d.include || d.include(ctx));
      stepsRef.current = included;
      ctxRef.current = ctx;

      setStatus({
        isActive: true,
        steps: included.map((d) => ({ id: d.id, label: d.label, status: "pending" as const })),
        currentDetail: "",
        elapsedSeconds: 0,
        estimatedTotalSeconds,
        failed: false,
        errorMessage: null,
      });

      elapsedIntervalRef.current = setInterval(() => {
        setStatus((s) => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
      }, 1000);

      activateStep(0);
    },
    [clearAllTimers]
  );

  // Cascades any pending/active steps to completed 200ms apart (covers both
  // the "real response landed right on time" and "arrived early" cases),
  // then settles isActive to false.
  const complete = useCallback(() => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    if (detailIntervalRef.current) clearInterval(detailIntervalRef.current);

    const total = stepsRef.current.length;
    const remainingIndices: number[] = [];
    for (let i = activeIndexRef.current; i < total; i++) remainingIndices.push(i);

    if (remainingIndices.length === 0) {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      setStatus((s) => ({ ...s, isActive: false }));
      return;
    }

    remainingIndices.forEach((stepIndex, order) => {
      const t = setTimeout(() => {
        setStatus((s) => ({
          ...s,
          steps: s.steps.map((step, si) => (si === stepIndex ? { ...step, status: "completed" as const } : step)),
        }));
        if (order === remainingIndices.length - 1) {
          const doneTimeout = setTimeout(() => {
            if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
            setStatus((s) => ({ ...s, isActive: false }));
          }, CASCADE_STEP_MS);
          cascadeTimeoutsRef.current.push(doneTimeout);
        }
      }, order * CASCADE_STEP_MS);
      cascadeTimeoutsRef.current.push(t);
    });
  }, []);

  const fail = useCallback((message: string) => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    if (detailIntervalRef.current) clearInterval(detailIntervalRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    setStatus((s) => ({
      ...s,
      isActive: false,
      failed: true,
      errorMessage: message,
      steps: s.steps.map((step, i) => (i === activeIndexRef.current ? { ...step, status: "failed" as const } : step)),
    }));
  }, []);

  const reset = useCallback(() => {
    clearAllTimers();
    setStatus(idleStatus());
  }, [clearAllTimers]);

  return { status, start, complete, fail, reset };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Rocket,
  Download,
  ExternalLink,
  Github,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  Wand2,
  RotateCw,
  Code2,
  Activity as ActivityIcon,
  Eye,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GenerationProgress } from "@/components/GenerationProgress";
import { CodeView } from "@/components/rightpanel/CodeView";
import { ActivityLog } from "@/components/rightpanel/ActivityLog";
import { FarmPlanCard } from "@/components/farm/FarmPlanCard";
import { useStepProgress } from "@/hooks/useStepProgress";
import { useCodeTyping, type CodeTypingState } from "@/hooks/useCodeTyping";
import { DEPLOY_STEPS, REFINE_STEPS, type StepDef, type ProgressContext } from "@/lib/progressSteps";
import { cn } from "@/lib/utils";
import type { AgentMode, DeployResult, FarmMeta, FarmPlan, GenerationStatus, Site, SiteFile } from "@/types";

type DeviceView = "desktop" | "tablet" | "phone";
type RightTab = "preview" | "code" | "activity";

const DEFAULT_PANEL_WIDTH = 560;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH_RATIO = 0.7;

function pageLabel(path: string) {
  if (path === "index.html") return "Home";
  return path.replace(/\.html$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Inlines styles.css/script.js into the selected page for the static (non-
// sandbox) iframe fallback — same approach the deleted SplitViewPreview used.
function buildPreviewHtml(files: SiteFile[], page: string) {
  const get = (p: string) => files.find((f) => f.path === p)?.content || "";
  let html = get(page);
  const css = get("styles.css");
  const js = get("script.js");
  if (css) {
    const linkRe = /<link[^>]*href=["']\.?\/?styles\.css["'][^>]*>/i;
    html = linkRe.test(html) ? html.replace(linkRe, `<style>${css}</style>`) : html.replace("</head>", `<style>${css}</style></head>`);
  }
  if (js) {
    const scriptRe = /<script[^>]*src=["']\.?\/?script\.js["'][^>]*>\s*<\/script>/i;
    const inline = `<script>${js.replace(/<\/script>/gi, "<\\/script>")}</script>`;
    html = scriptRe.test(html) ? html.replace(scriptRe, inline) : html.replace("</body>", `${inline}</body>`);
  }
  return html;
}

interface RightPanelProps {
  mode: AgentMode;
  layout: "inline" | "overlay";
  fullScreen: boolean;
  open: boolean;
  onClose: () => void;

  site: Site | null;
  deployed: "pending" | DeployResult | null;
  deployError: string | null;
  consoleError: string | null;
  sandboxPreviewUrl: string | null;
  refinedCount?: number;
  onDeploy: () => void;
  onDownload: () => void;
  onRefine: (text: string) => void;
  onRestartSandbox: () => void;
  refining: boolean;
  restarting: boolean;

  plan: FarmPlan | null;
  planMeta: FarmMeta | null;

  generationActive: boolean;
  generationStatus: GenerationStatus;
  generationStepDefs: StepDef[];
  generationCtx: ProgressContext;
  /** Real, event-driven typing state (Builder's live SSE stream) — takes
   *  priority over the simulated useCodeTyping reveal when present. */
  liveTyping?: CodeTypingState | null;
}

export function RightPanel({
  mode,
  layout,
  fullScreen,
  open,
  onClose,
  site,
  deployed,
  deployError,
  consoleError,
  sandboxPreviewUrl,
  refinedCount,
  onDeploy,
  onDownload,
  onRefine,
  onRestartSandbox,
  refining,
  restarting,
  plan,
  planMeta,
  generationActive,
  generationStatus,
  generationStepDefs,
  generationCtx,
  liveTyping,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const [device, setDevice] = useState<DeviceView>("desktop");
  const [activePage, setActivePage] = useState("index.html");
  const [refineText, setRefineText] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [typingActive, setTypingActive] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const lastRefineTextRef = useRef("");

  const deployProgress = useStepProgress();
  const refineProgress = useStepProgress();
  const prevDeployedRef = useRef<typeof deployed>(null);
  const prevRefiningRef = useRef(false);
  const prevGenerationActiveRef = useRef(false);

  const hasResult = !!site || !!plan;
  const files: SiteFile[] = site ? site.files : plan ? [{ path: "plan.json", content: JSON.stringify(plan, null, 2) }] : [];
  const htmlFiles = files.filter((f) => f.path.endsWith(".html"));

  const simulatedTyping = useCodeTyping(files, typingActive, () => {
    setTypingActive(false);
    setActiveTab("preview");
  });
  // Builder streams real file events during generation — no simulated reveal
  // needed once it's done, the user already watched it write live.
  const typing = liveTyping ?? simulatedTyping;

  // Orchestrates the auto-tab sequence. Builder: Code (live streaming) while
  // generating → Preview the instant it's done. Farm (no real streaming):
  // Activity while generating → Code (typing simulation) once a result lands
  // → Preview once typing settles.
  useEffect(() => {
    if (generationActive) {
      setActiveTab(mode === "builder" ? "code" : "activity");
    } else if (prevGenerationActiveRef.current && !generationActive && hasResult) {
      if (mode === "builder") {
        setActiveTab("preview");
      } else {
        setActiveTab("code");
        setTypingActive(true);
      }
    }
    prevGenerationActiveRef.current = generationActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationActive, hasResult, mode]);

  useEffect(() => {
    if (htmlFiles.length && !htmlFiles.some((f) => f.path === activePage)) setActivePage(htmlFiles[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  useEffect(() => {
    const wasPending = prevDeployedRef.current === "pending";
    if (deployed === "pending" && !wasPending) {
      deployProgress.start(DEPLOY_STEPS, 8, { fileNames: site?.files.map((f) => f.path) || [] });
    } else if (wasPending && deployed && deployed !== "pending") {
      deployProgress.complete();
    } else if (wasPending && deployed === null && deployError) {
      deployProgress.fail(deployError);
    }
    prevDeployedRef.current = deployed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployed, deployError]);

  useEffect(() => {
    if (refining && !prevRefiningRef.current) {
      refineProgress.start(REFINE_STEPS, 6, { changeRequest: lastRefineTextRef.current });
    } else if (!refining && prevRefiningRef.current) {
      refineProgress.complete();
    }
    prevRefiningRef.current = !!refining;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refining]);

  // Drag-to-resize (inline/desktop layout only — the handle isn't rendered
  // for the overlay layout). Width lives in component state, not persisted
  // across reloads; only "resizable" was asked for, not "remembers my width."
  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(e: MouseEvent) {
      const maxWidth = window.innerWidth * MAX_PANEL_WIDTH_RATIO;
      const next = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(next);
    }
    function onMouseUp() {
      setIsDragging(false);
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  async function copyDeployUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 1500);
  }

  function submitRefine() {
    const text = refineText.trim();
    if (!text || refining) return;
    lastRefineTextRef.current = text;
    onRefine(text);
    setRefineText("");
  }

  function openInNewTab() {
    if (!site) return;
    const html = buildPreviewHtml(site.files, activePage);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  const isLive = !!sandboxPreviewUrl;
  const iframeSrc = isLive ? `${sandboxPreviewUrl}${activePage === "index.html" ? "" : `/${activePage}`}` : undefined;
  const iframeSrcDoc = isLive || !site ? undefined : buildPreviewHtml(site.files, activePage);

  const content = (
    <div className="flex h-full flex-col bg-bg-base">
      <div className="flex flex-shrink-0 items-center border-b border-border bg-bg-surface">
        {(["preview", "code", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-medium capitalize transition-colors",
              activeTab === tab ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-secondary"
            )}
          >
            {tab === "preview" && <Eye className="h-3.5 w-3.5" />}
            {tab === "code" && <Code2 className="h-3.5 w-3.5" />}
            {tab === "activity" && <ActivityIcon className="h-3.5 w-3.5" />}
            {tab}
          </button>
        ))}
        <button
          onClick={onClose}
          className="mr-2 shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "preview" &&
          (mode === "farm" ? (
            plan && planMeta ? (
              <div className="h-full overflow-y-auto p-4">
                <FarmPlanCard plan={plan} meta={planMeta} />
              </div>
            ) : (
              <IdleState />
            )
          ) : generationActive && mode === "builder" ? (
            // Files are still streaming in — never hand the iframe partial/
            // broken markup. The Code tab (the default view while generating)
            // is where the live action actually is.
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
              <Code2 className="h-8 w-8 animate-pulse opacity-15" />
              <p className="text-sm font-medium text-text-secondary">Building your site…</p>
              <p className="text-xs">Switch to the Code tab to watch it write in real time.</p>
            </div>
          ) : site ? (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {htmlFiles.length > 1 && (
                    <select
                      value={activePage}
                      onChange={(e) => setActivePage(e.target.value)}
                      className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary outline-none focus-visible:border-accent"
                    >
                      {htmlFiles.map((f) => (
                        <option key={f.path} value={f.path}>
                          {pageLabel(f.path)}
                        </option>
                      ))}
                    </select>
                  )}
                  {isLive ? (
                    <Badge className="border-transparent bg-emerald-500 text-white">Live sandbox</Badge>
                  ) : (
                    <Badge className="border-transparent bg-amber-400 text-black">Static preview</Badge>
                  )}
                  {!!refinedCount && <Badge variant="muted">Refined {refinedCount}x</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 rounded-md border border-border bg-bg-elevated p-0.5">
                    {(
                      [
                        ["desktop", Monitor],
                        ["tablet", Tablet],
                        ["phone", Smartphone],
                      ] as const
                    ).map(([view, Icon]) => (
                      <button
                        key={view}
                        onClick={() => setDevice(view)}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded",
                          device === view ? "bg-accent text-black" : "text-text-secondary hover:text-text-primary"
                        )}
                        aria-label={view}
                        title={view}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={openInNewTab}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                    aria-label="Open in new tab"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setIframeKey((k) => k + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                    aria-label="Refresh preview"
                    title="Refresh preview"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  {isLive && (
                    <button
                      onClick={onRestartSandbox}
                      disabled={restarting}
                      className="flex h-7 items-center gap-1 rounded-md px-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
                      aria-label="Restart sandbox"
                      title="Restart sandbox"
                    >
                      {restarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                      <span className="text-[11px]">Sandbox</span>
                    </button>
                  )}
                </div>
              </div>

              {consoleError && (
                <div className="flex items-start gap-2 border-b border-border bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{consoleError}</span>
                </div>
              )}

              <div className={cn("flex flex-1 items-center justify-center overflow-auto", device !== "desktop" && "bg-bg-elevated py-4")}>
                {device === "desktop" ? (
                  <iframe
                    key={iframeKey}
                    sandbox={isLive ? undefined : "allow-scripts"}
                    src={iframeSrc}
                    srcDoc={iframeSrcDoc}
                    title={site.name}
                    className="h-full w-full bg-white"
                  />
                ) : (
                  <div
                    className={cn(
                      "relative mx-auto h-full overflow-hidden bg-white shadow-xl",
                      device === "tablet"
                        ? "w-[768px] max-w-full rounded-[24px] border-[8px] border-neutral-800"
                        : "w-[375px] max-w-full rounded-[32px] border-[10px] border-neutral-900"
                    )}
                  >
                    {device === "phone" && (
                      <div className="absolute left-1/2 top-0 z-10 h-4 w-24 -translate-x-1/2 rounded-b-xl bg-neutral-900" />
                    )}
                    <iframe
                      key={iframeKey}
                      sandbox={isLive ? undefined : "allow-scripts"}
                      src={iframeSrc}
                      srcDoc={iframeSrcDoc}
                      title={site.name}
                      className="h-full w-full"
                    />
                    {device === "phone" && (
                      <div className="absolute bottom-1.5 left-1/2 z-10 h-1 w-20 -translate-x-1/2 rounded-full bg-neutral-900/60" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-border bg-bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!deployed && (
                    <Button size="sm" onClick={onDeploy}>
                      <Rocket className="h-3.5 w-3.5" /> Deploy Live
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={onDownload}>
                    <Download className="h-3.5 w-3.5" /> Download .zip
                  </Button>
                  {deployed && deployed !== "pending" && deployed.url && (
                    <div className="flex animate-glow-pulse items-center gap-1.5 rounded-full border border-accent bg-accent-glow px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      <a href={deployed.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:underline">
                        {deployed.url.replace("https://", "")}
                      </a>
                      <button
                        onClick={() => deployed.url && copyDeployUrl(deployed.url)}
                        className="text-accent hover:text-accent-hover"
                        aria-label="Copy live URL"
                      >
                        {urlCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  {deployed && deployed !== "pending" && deployed.repo && (
                    <a href={deployed.repo} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-text-secondary hover:underline">
                      <Github className="h-3.5 w-3.5" /> repo
                    </a>
                  )}
                </div>

                {(deployProgress.status.isActive || deployProgress.status.failed) && (
                  <GenerationProgress
                    title="Deploying your site"
                    status={deployProgress.status}
                    compact
                    onRetry={() => {
                      deployProgress.reset();
                      onDeploy();
                    }}
                  />
                )}

                {refineProgress.status.isActive ? (
                  <GenerationProgress title="Refining your site" status={refineProgress.status} compact />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={refineText}
                      onChange={(e) => setRefineText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRefine();
                      }}
                      placeholder="Describe what to change…"
                      disabled={refining}
                      className="h-9 flex-1 rounded-md border border-border bg-bg-elevated px-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent disabled:opacity-60"
                    />
                    <button
                      onClick={submitRefine}
                      disabled={refining || !refineText.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Refine"
                    >
                      {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <IdleState />
          ))}

        {activeTab === "code" && (files.length > 0 ? <CodeView files={files} typing={typing} /> : <IdleState message="No files yet" />)}

        {activeTab === "activity" && (
          <ActivityLog
            status={generationStatus}
            stepDefs={generationStepDefs}
            ctx={generationCtx}
            resultSummary={
              site
                ? { files: site.files.length, lines: site.files.reduce((n, f) => n + f.content.split("\n").length, 0) }
                : null
            }
          />
        )}
      </div>
    </div>
  );

  if (layout === "overlay") {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50"
            />
            <motion.div
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className={cn("fixed bottom-0 right-0 top-0 z-50 border-l border-border shadow-2xl", fullScreen ? "w-full" : "w-full max-w-[480px]")}
            >
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div
      style={{ width: open ? `${panelWidth}px` : "0" }}
      className={cn(
        "relative flex h-full shrink-0 overflow-hidden",
        !isDragging && "transition-[width] duration-300 ease-in-out",
        open && "border-l border-border"
      )}
    >
      {open && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-accent/30"
          aria-hidden
        />
      )}
      <div className="h-full w-full" style={{ minWidth: MIN_PANEL_WIDTH }}>
        {content}
      </div>
    </div>
  );
}

function IdleState({ message }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
      <Code2 className="h-8 w-8 opacity-15" />
      <p className="text-sm font-medium text-text-secondary">{message || "Your generated website will appear here"}</p>
      {!message && <p className="text-xs">Describe a website in the chat to get started</p>}
    </div>
  );
}

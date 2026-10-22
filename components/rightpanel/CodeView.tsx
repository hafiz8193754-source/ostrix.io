"use client";

import { useEffect, useState } from "react";
import { Copy, Check, FileCode2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { highlightLine, languageFromPath } from "@/lib/syntaxHighlight";
import type { CodeTypingState } from "@/hooks/useCodeTyping";
import type { SiteFile } from "@/types";

interface CodeViewProps {
  files: SiteFile[];
  typing: CodeTypingState;
}

function fileSize(content: string) {
  const bytes = new Blob([content]).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function CodeView({ files, typing }: CodeViewProps) {
  const [activeFile, setActiveFile] = useState(files[0]?.path || "");
  const [copied, setCopied] = useState(false);

  // Auto-follow the file currently being "typed"; once typing settles the
  // user can freely click between files.
  useEffect(() => {
    if (typing.isActive) {
      const current = files[typing.currentFileIndex];
      if (current) setActiveFile(current.path);
    }
  }, [typing.isActive, typing.currentFileIndex, files]);

  useEffect(() => {
    if (!activeFile && files[0]) setActiveFile(files[0].path);
  }, [files, activeFile]);

  const activeIndex = files.findIndex((f) => f.path === activeFile);
  const file = files[activeIndex] ?? files[0];
  if (!file) return null;

  const isTypingThisFile = typing.isActive && typing.currentFileIndex === activeIndex;
  const allLines = file.content.split("\n");
  const visibleLineCount = isTypingThisFile ? Math.min(typing.visibleLines, allLines.length) : allLines.length;
  const displayedLines = allLines.slice(0, visibleLineCount);
  const language = languageFromPath(file.path);

  async function copyFile() {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-full">
      {files.length > 1 && (
        <div className="w-40 shrink-0 overflow-y-auto border-r border-border bg-bg-surface">
          {files.map((f, i) => {
            const started = !typing.isActive || i <= typing.currentFileIndex;
            const isTypingRow = typing.isActive && i === typing.currentFileIndex;
            const lineCount = f.content.split("\n").length;
            return (
              <button
                key={f.path}
                onClick={() => started && setActiveFile(f.path)}
                disabled={!started}
                className={cn(
                  "flex w-full items-center gap-1.5 border-l-2 px-3 py-2 text-left font-mono-code text-[11px] transition-colors",
                  f.path === activeFile ? "border-accent bg-accent-glow text-accent" : "border-transparent text-text-muted hover:text-text-secondary",
                  !started && "cursor-not-allowed opacity-30",
                  isTypingRow && "animate-pulse"
                )}
              >
                <FileCode2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{f.path}</span>
                {isTypingRow && <span className="shrink-0 text-[9px] text-text-muted">{typing.visibleLines}/{lineCount}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto font-mono-code text-[12.5px] leading-[1.65]" style={{ background: "var(--code-bg)" }}>
          {displayedLines.map((line, i) => {
            const isLastVisible = isTypingThisFile && i === displayedLines.length - 1;
            const tokens = highlightLine(line, language);
            return (
              <div key={i} className="flex min-h-[20px] px-0">
                <span className="w-12 shrink-0 select-none pr-4 text-right text-[#3A3A3A]">{i + 1}</span>
                <span className="flex-1 whitespace-pre text-[#E5E7EB]">
                  {tokens.map((t, ti) => (
                    <span key={ti} className={t.className}>
                      {t.text}
                    </span>
                  ))}
                  {isLastVisible && <span className="ml-0.5 inline-block h-[15px] w-[2px] animate-blink bg-accent align-text-bottom" />}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t border-border bg-bg-surface px-4 py-2 font-mono-code text-[11px] text-text-muted">
          <span>
            {file.path} · {allLines.length} lines · {fileSize(file.content)}
          </span>
          <button onClick={copyFile} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy File"}
          </button>
        </div>
      </div>
    </div>
  );
}

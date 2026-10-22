"use client";

import { useEffect, useRef, useState } from "react";

import type { SiteFile } from "@/types";

const CHUNK_MIN_LINES = 3;
const CHUNK_MAX_LINES = 5;
const CHUNK_DELAY_MS = 300;
const FILE_SWITCH_DELAY_MS = 800;

export interface CodeTypingState {
  currentFileIndex: number;
  visibleLines: number;
  isActive: boolean;
}

// Simulates a developer typing out the generated files in the Code tab:
// reveals a few lines at a time (not character-by-character — too slow for
// a full file), pausing briefly between chunks and longer when it moves to
// the next file. `files` is read via a ref rather than an effect dependency
// so a fresh-but-equivalent array reference from the caller's render never
// restarts an in-progress typing sequence.
export function useCodeTyping(files: SiteFile[], active: boolean, onComplete?: () => void) {
  const [state, setState] = useState<CodeTypingState>({ currentFileIndex: 0, visibleLines: 0, isActive: false });

  const filesRef = useRef(files);
  filesRef.current = files;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || filesRef.current.length === 0) {
      setState({ currentFileIndex: 0, visibleLines: 0, isActive: false });
      return;
    }

    let cancelled = false;
    setState({ currentFileIndex: 0, visibleLines: 0, isActive: true });

    function typeNext(fileIndex: number, lines: number, delay: number) {
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        const currentFiles = filesRef.current;
        const file = currentFiles[fileIndex];
        const totalLines = file.content === "" ? 0 : file.content.split("\n").length;

        if (lines >= totalLines) {
          if (fileIndex + 1 < currentFiles.length) {
            setState({ currentFileIndex: fileIndex + 1, visibleLines: 0, isActive: true });
            typeNext(fileIndex + 1, 0, FILE_SWITCH_DELAY_MS);
          } else {
            setState((s) => ({ ...s, isActive: false }));
            onCompleteRef.current?.();
          }
          return;
        }

        const chunk = CHUNK_MIN_LINES + Math.floor(Math.random() * (CHUNK_MAX_LINES - CHUNK_MIN_LINES + 1));
        const nextLines = Math.min(lines + chunk, totalLines);
        setState({ currentFileIndex: fileIndex, visibleLines: nextLines, isActive: true });
        typeNext(fileIndex, nextLines, CHUNK_DELAY_MS);
      }, delay);
    }

    typeNext(0, 0, 0);

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active]);

  return state;
}

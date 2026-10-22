"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
}

// Plain pointer-events canvas — no drawing library. toDataURL() on demand,
// blank-check via a tracked "hasDrawn" flag rather than pixel inspection.
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad({ width = 400, height = 140 }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1C1C1C";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    // Canvas is CSS-scaled to the container width on phones; map back to canvas pixels.
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }

  function end() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (hasDrawn ? canvasRef.current?.toDataURL("image/png") || null : null),
    clear,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        data-testid="signature-pad"
        style={{ width: "100%", maxWidth: width, aspectRatio: `${width} / ${height}` }}
        className="touch-none rounded-lg border border-border bg-white"
      />
      <button
        type="button"
        onClick={clear}
        className="flex w-fit items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <Eraser className="h-3 w-3" /> Clear signature
      </button>
    </div>
  );
});

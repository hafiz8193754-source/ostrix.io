// Turns raw token deltas (as they arrive from streamComplete) into live
// file-start/file-delta/file-done events, using the same ===FILE: path===
// / ===END=== markers lib/siteFiles.ts's parseFiles/parseProject already
// parse from a complete string. This parser only has to be "good enough for
// a nice live UX" — once the stream ends, the route re-parses the full
// accumulated text with the existing, well-tested parseProject for the
// authoritative Site, so a mistimed boundary here never corrupts what's saved.
export type ProjectStreamEvent =
  | { type: "file-start"; path: string }
  | { type: "file-delta"; path: string; chunk: string }
  | { type: "file-done"; path: string; content: string };

interface Marker {
  kind: "file" | "end";
  path: string | null;
  start: number;
  end: number;
}

const MARKER_RE = /===(?:FILE:\s*([^\s=]+)\s*|END)===/g;

// If the buffer's tail could be the start of a "===..." marker that just
// hasn't finished arriving yet, don't emit it as visible content — hold it
// back until either it resolves into a real marker or more text disproves it.
function safeTailCut(text: string): number {
  const tailStart = Math.max(0, text.length - 20);
  const tail = text.slice(tailStart);
  const eq = tail.indexOf("===");
  return eq === -1 ? text.length : tailStart + eq;
}

export class ProjectStreamParser {
  private buffer = "";
  private markers: Marker[] = [];
  private openFile: { path: string; contentStart: number; emittedUpTo: number } | null = null;
  private finished = false;

  feed(chunk: string): ProjectStreamEvent[] {
    this.buffer += chunk;
    const events: ProjectStreamEvent[] = [];
    if (this.finished) return events;

    MARKER_RE.lastIndex = 0;
    const found: Marker[] = [];
    let m: RegExpExecArray | null;
    while ((m = MARKER_RE.exec(this.buffer)) !== null) {
      found.push({ kind: m[1] ? "file" : "end", path: m[1] || null, start: m.index, end: m.index + m[0].length });
    }

    if (found.length > this.markers.length) {
      for (let i = this.markers.length; i < found.length; i++) {
        const marker = found[i];
        if (this.openFile) {
          const content = this.buffer.slice(this.openFile.contentStart, marker.start).trim();
          events.push({ type: "file-done", path: this.openFile.path, content });
          this.openFile = null;
        }
        if (marker.kind === "file" && marker.path) {
          this.openFile = { path: marker.path, contentStart: marker.end, emittedUpTo: marker.end };
          events.push({ type: "file-start", path: marker.path });
        } else if (marker.kind === "end") {
          this.finished = true;
        }
      }
      this.markers = found;
    }

    if (this.openFile && !this.finished) {
      const safeEnd = safeTailCut(this.buffer);
      if (safeEnd > this.openFile.emittedUpTo) {
        const newChunk = this.buffer.slice(this.openFile.emittedUpTo, safeEnd);
        this.openFile.emittedUpTo = safeEnd;
        if (newChunk) events.push({ type: "file-delta", path: this.openFile.path, chunk: newChunk });
      }
    }

    return events;
  }
}

// Friendly per-path phrasing, shared by the server (status-line text) and
// the client (Activity tab step labels) so the wording only lives once.
export function friendlyFileLabel(path: string): string {
  if (path === "index.html") return "Building homepage";
  if (path === "styles.css") return "Styling the design";
  if (path === "script.js") return "Wiring up interactions";
  if (path === "404.html") return "Building 404 page";
  if (path === "api/contact.js") return "Adding contact form backend";
  if (path === "api/booking.js") return "Adding booking system";
  if (path === "api/newsletter.js") return "Adding newsletter signup";
  if (path.startsWith("api/")) {
    const name = path.replace(/^api\//, "").replace(/\.js$/, "");
    return `Adding ${name} backend`;
  }
  if (path.endsWith(".html")) {
    const label = path
      .replace(/\.html$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Writing ${label} page`;
  }
  return `Writing ${path}`;
}

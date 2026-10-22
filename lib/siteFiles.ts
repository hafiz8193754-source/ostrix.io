import type { Site, SiteFile } from "@/types";

// Parses the ===FILE: path===\n(content)===FILE:|===END=== marker format shared
// by both the initial generation and the surgical refine endpoint. Tolerant of
// truncation: keeps every complete file it finds.
export function parseFiles(raw: string): SiteFile[] {
  const text = raw.replace(/```[a-z]*\n?|```/g, "");
  const files: SiteFile[] = [];
  const re = /===FILE:\s*([^\s=]+)\s*===\n?([\s\S]*?)(?====FILE:|===END===|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim();
    const content = m[2].trim();
    if (path && content) files.push({ path, content });
  }
  return files;
}

// Full-project parse: also pulls the ===META name="" summary=""=== line and
// falls back to a slugified brief if the model omits it.
export function parseProject(raw: string, brief: string): Site {
  const text = raw.replace(/```[a-z]*\n?|```/g, "");
  // Quote-agnostic: the system prompt's example uses single quotes, but earlier
  // generations may still use double quotes — accept either.
  const metaMatch = text.match(/===META\s+name=["']([^"']*)["']\s+summary=["']([^"']*)["']\s*===/);
  const fallback = brief.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "my-site";
  const files = parseFiles(text);
  if (!files.some((f) => f.path === "index.html")) throw new Error("no index.html");
  return {
    name: (metaMatch && metaMatch[1]) || fallback,
    summary: (metaMatch && metaMatch[2]) || brief,
    files,
  };
}

// Overlays refined files onto the current project by path, keeping every file
// the refine pass didn't touch.
export function mergeFiles(current: SiteFile[], updated: SiteFile[]): SiteFile[] {
  const merged = [...current];
  for (const file of updated) {
    const idx = merged.findIndex((f) => f.path === file.path);
    if (idx === -1) merged.push(file);
    else merged[idx] = file;
  }
  return merged;
}

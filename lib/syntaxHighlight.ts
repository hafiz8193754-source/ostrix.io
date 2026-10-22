// Simple, single-pass, regex-based syntax highlighter for the Code tab.
// Deliberately not a real parser — basic keyword/tag/string coloring reads
// dramatically better than monochrome text, and that's the whole goal here.
// Colors are a fixed dark-code palette (independent of the app's light/dark
// theme), matching the existing precedent of --code-bg and the syntax
// highlighter already used elsewhere in this app.

export type CodeLanguage = "html" | "css" | "js" | "json" | "text";

export function languageFromPath(path: string): CodeLanguage {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "text";
}

export interface Token {
  text: string;
  className?: string;
}

interface PatternRule {
  name: string;
  source: string;
  className: string;
}

const COLOR = {
  tag: "text-[#FF8C00]",
  attr: "text-[#93C5FD]",
  string: "text-[#86EFAC]",
  prop: "text-[#C4B5FD]",
  value: "text-[#93C5FD]",
  keyword: "text-[#F472B6]",
  comment: "text-[#6B7280] italic",
  punct: "text-[#9CA3AF]",
  number: "text-[#FBBF24]",
};

function tokenize(line: string, rules: PatternRule[]): Token[] {
  if (!line) return [{ text: "" }];
  const combined = new RegExp(rules.map((r) => `(?<${r.name}>${r.source})`).join("|"), "g");
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(line)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: line.slice(lastIndex, match.index) });
    const rule = rules.find((r) => match!.groups?.[r.name] !== undefined);
    tokens.push({ text: match[0], className: rule?.className });
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) combined.lastIndex++;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex) });
  return tokens;
}

const HTML_RULES: PatternRule[] = [
  { name: "comment", source: "<!--[\\s\\S]*?-->", className: COLOR.comment },
  { name: "string", source: `"[^"]*"|'[^']*'`, className: COLOR.string },
  { name: "tag", source: "</?[a-zA-Z][\\w-]*", className: COLOR.tag },
  { name: "attr", source: "\\b[a-zA-Z-]+(?=\\s*=)", className: COLOR.attr },
  { name: "punct", source: "/?>|=", className: COLOR.punct },
];

const CSS_RULES: PatternRule[] = [
  { name: "comment", source: "/\\*[\\s\\S]*?\\*/", className: COLOR.comment },
  { name: "string", source: `"[^"]*"|'[^']*'`, className: COLOR.string },
  { name: "hex", source: "#[0-9a-fA-F]{3,8}\\b", className: COLOR.value },
  { name: "prop", source: "[a-zA-Z-]+(?=\\s*:)", className: COLOR.prop },
  { name: "number", source: "-?\\d+\\.?\\d*(px|rem|em|%|vh|vw|s|ms|deg)?", className: COLOR.number },
  { name: "punct", source: "[{}:;]", className: COLOR.punct },
];

const JS_KEYWORDS =
  "function|const|let|var|if|else|return|for|while|class|import|export|default|async|await|try|catch|new|this|true|false|null";

const JS_RULES: PatternRule[] = [
  { name: "comment", source: "//.*$|/\\*[\\s\\S]*?\\*/", className: COLOR.comment },
  { name: "string", source: "`[^`]*`|\"[^\"]*\"|'[^']*'", className: COLOR.string },
  { name: "keyword", source: `\\b(?:${JS_KEYWORDS})\\b`, className: COLOR.keyword },
  { name: "number", source: "\\b\\d+\\.?\\d*\\b", className: COLOR.number },
  { name: "punct", source: "[{}()\\[\\];,.]", className: COLOR.punct },
];

export function highlightLine(line: string, language: CodeLanguage): Token[] {
  switch (language) {
    case "html":
      return tokenize(line, HTML_RULES);
    case "css":
      return tokenize(line, CSS_RULES);
    case "js":
    case "json":
      return tokenize(line, JS_RULES);
    default:
      return [{ text: line }];
  }
}

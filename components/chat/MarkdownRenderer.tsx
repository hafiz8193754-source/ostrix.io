"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-2 overflow-hidden rounded-md border border-border" style={{ background: "var(--code-bg)" }}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{language || "text"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, background: "transparent", padding: "12px 14px", fontSize: "12.5px" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Dedicated rendering for the Prompt Engineer's finished, ready-to-copy
// website brief — the model wraps it in a ```prompt fence (see the agent's
// system prompt) so this can get its own chrome instead of the generic
// syntax-highlighted CodeBlock. Copy buttons top AND bottom, per spec.
function PromptBlock({ text }: { text: string }) {
  const [copiedTop, setCopiedTop] = useState(false);
  const [copiedBottom, setCopiedBottom] = useState(false);

  async function copy(which: "top" | "bottom") {
    await navigator.clipboard.writeText(text);
    if (which === "top") {
      setCopiedTop(true);
      setTimeout(() => setCopiedTop(false), 1500);
    } else {
      setCopiedBottom(true);
      setTimeout(() => setCopiedBottom(false), 1500);
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-accent/30 bg-bg-elevated">
      <div className="flex items-center justify-between border-b border-border bg-accent-glow px-3.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">Ready to copy</span>
        <button
          onClick={() => copy("top")}
          className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-black transition-colors hover:bg-accent-hover"
        >
          {copiedTop ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiedTop ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words px-4 py-3.5 text-[13px] leading-relaxed text-text-primary">{text}</pre>
      <div className="flex items-center justify-between border-t border-border px-3.5 py-2">
        <span className="text-[11px] text-text-muted">Copy the block above.</span>
        <button
          onClick={() => copy("bottom")}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
        >
          {copiedBottom ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiedBottom ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const components: Components = {
  code({ className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className || "");
    if (match?.[1] === "prompt") {
      return <PromptBlock text={String(children).replace(/\n$/, "")} />;
    }
    if (match) {
      return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="rounded bg-bg-elevated px-1 py-0.5 text-[0.9em] text-text-primary" {...rest}>
        {children}
      </code>
    );
  },
  a({ children, ...rest }) {
    return (
      <a className="text-accent underline underline-offset-2 hover:text-accent-hover" target="_blank" rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  },
  p({ children }) {
    return <p className="leading-relaxed">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5">{children}</ol>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-text-primary">{children}</strong>;
  },
  blockquote({ children }) {
    return <blockquote className="border-l-2 border-border pl-3 text-text-secondary">{children}</blockquote>;
  },
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-text-primary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { FileText, Link2 } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

interface MessageBubbleProps {
  role: "user" | "agent";
  text: string;
  photo?: string;
  attachments?: { kind: "image" | "pdf"; name: string; preview?: string }[];
  sourceUrl?: string;
}

export function MessageBubble({ role, text, photo, attachments, sourceUrl }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}
    >
      {!isUser && (
        <div className="mt-1 shrink-0">
          <OstrixLogo size="xs" />
        </div>
      )}
      <div
        className={`max-w-[720px] rounded-[18px] px-5 py-3.5 text-[15px] leading-[1.65] ${
          isUser
            ? "rounded-br-sm bg-bg-elevated text-text-primary"
            : "rounded-bl-sm border border-border bg-bg-surface text-text-primary"
        }`}
      >
        {isUser ? (
          <>
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
            {photo && <img src={photo} alt="Uploaded" className="mt-2 max-w-[180px] rounded-md" />}
            {(attachments?.length || sourceUrl) && (
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                {attachments?.map((a, i) =>
                  a.kind === "image" && a.preview ? (
                    <img key={i} src={a.preview} alt={a.name} className="h-14 w-14 rounded-md object-cover" />
                  ) : (
                    <span key={i} className="flex items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-xs text-text-secondary">
                      <FileText className="h-3 w-3" /> {a.name}
                    </span>
                  )
                )}
                {sourceUrl && (
                  <span className="flex max-w-[220px] items-center gap-1 truncate rounded-md bg-black/10 px-2 py-1 text-xs text-text-secondary">
                    <Link2 className="h-3 w-3 shrink-0" /> {sourceUrl}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <MarkdownRenderer content={text} />
        )}
      </div>
    </motion.div>
  );
}

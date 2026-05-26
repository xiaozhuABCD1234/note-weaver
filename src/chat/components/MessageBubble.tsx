import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "obsidian";
import type { App, Component } from "obsidian";
import type { ApiMessage } from "@/types";
import { Copy, Check } from "lucide-react";

interface MessageBubbleProps {
  message: ApiMessage;
  component: Component;
  app: App;
}

function formatTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function isErrorMessage(content: string): boolean {
  return content.startsWith("错误:") || content.startsWith("Error:");
}

export function MessageBubble({ message, component, app }: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (message.role !== "assistant" || !message.content || !bubbleRef.current) return;
    bubbleRef.current.innerHTML = "";
    void MarkdownRenderer.render(app, message.content, bubbleRef.current, "", component);
  }, [message.content, app, component]);

  if (message.role === "tool") return null;
  if (message.role === "assistant" && "tool_calls" in message && !message.content) return null;

  const isUser = message.role === "user";
  const isError = !isUser && message.content ? isErrorMessage(message.content) : false;

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const roleLabel = isUser ? "你" : "AI";
  const time = formatTime();

  return (
    <div
      className={`message ${isUser ? "message-user" : "message-assistant"}${isError ? " message-error" : ""}`}
    >
      <div className="message-header">
        <span className="message-role-label">{roleLabel}</span>
        <span className="message-time">{time}</span>
      </div>
      {isUser ? (
        <div className="message-content">
          <p>{message.content}</p>
        </div>
      ) : (
        <>
          <div ref={bubbleRef} className="message-content markdown-rendered" />
          {message.content && (
            <button
              className="message-copy-button"
              onClick={handleCopy}
              aria-label={copied ? "已复制" : "复制内容"}
            >
              {copied ? <Check size={22} /> : <Copy size={22} />}
            </button>
          )}
        </>
      )}
    </div>
  );
}

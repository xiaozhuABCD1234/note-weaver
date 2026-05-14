import { useEffect, useRef } from "react";
import { MarkdownRenderer } from "obsidian";
import type { App, Component } from "obsidian";
import type { ApiMessage, ChatMessage } from "@/types";

interface MessageBubbleProps {
  message: ApiMessage;
  component: Component;
  app: App;
}

export function MessageBubble({ message, component, app }: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message.role !== "assistant" || !message.content || !bubbleRef.current) return;
    bubbleRef.current.innerHTML = "";
    MarkdownRenderer.render(app, message.content, bubbleRef.current, "", component);
  }, [message.content, app, component]);

  if (message.role === "tool") return null;
  if (message.role === "assistant" && "tool_calls" in message && !message.content) return null;

  return (
    <div
      ref={message.role === "assistant" ? bubbleRef : undefined}
      className={`message ${message.role === "user" ? "message-user" : "message-assistant"}`}
    >
      {message.role === "user" && (message as ChatMessage).content}
    </div>
  );
}

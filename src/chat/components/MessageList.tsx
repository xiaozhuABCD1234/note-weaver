import { useEffect, useRef } from "react";
import type { App, Component } from "obsidian";
import type { ApiMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ApiMessage[];
  component: Component;
  app: App;
  isLoading: boolean;
  onSendExample?: (text: string) => void;
}

const EXAMPLES = [
  "帮我整理笔记",
  "构建知识图谱",
  "搜索最近修改的笔记",
];

export function MessageList({ messages, component, app, isLoading, onSendExample }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div ref={listRef} className="messages-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </div>
          <div className="empty-state-title">Note Weaver AI 助手</div>
          <div className="empty-state-desc">我可以帮你整理笔记、搜索知识库、回答问题</div>
          <div className="empty-state-examples">
            {EXAMPLES.map((text) => (
              <button
                key={text}
                className="example-chip"
                onClick={() => onSendExample?.(text)}
                aria-label={`示例: ${text}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="messages-wrapper">
      {messages.map((msg, i) => (
        <MessageBubble key={`${msg.role}-${i}`} message={msg} component={component} app={app} />
      ))}
      {isLoading && (
        <div className="typing-indicator">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import type { App, Component } from "obsidian";
import type { ApiMessage } from "../../types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ApiMessage[];
  component: Component;
  app: App;
}

export function MessageList({ messages, component, app }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={listRef} className="messages-wrapper">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} component={component} app={app} />
      ))}
    </div>
  );
}

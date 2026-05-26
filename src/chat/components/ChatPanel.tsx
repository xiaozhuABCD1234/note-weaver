import { useCallback, useEffect, useRef, useState } from "react";
import type { Component } from "obsidian";
import type { ChatDeps } from "@/chat/chat-service";
import { useChat } from "@/hooks/use-chat";
import { useApp } from "@/hooks/use-app";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  deps: ChatDeps;
  component: Component;
  pendingSelectionRef: { current: ((selection: string) => void) | null };
  initialPlaceHolder?: string;
}

export function ChatPanel({ deps, component, pendingSelectionRef }: ChatPanelProps) {
  const app = useApp();
  const { messages, isLoading, sendMessage, abort, setPendingSelection } = useChat(deps);
  const [inputPlaceholder, setInputPlaceholder] = useState("输入消息...");
  const inputRef = useRef<{ focus: () => void } | null>(null);

  useEffect(() => {
    pendingSelectionRef.current = (selection: string) => {
      setPendingSelection(selection);
      setInputPlaceholder("已选中文本，输入修改要求...");
      inputRef.current?.focus();
    };
    return () => {
      pendingSelectionRef.current = null;
    };
  }, [setPendingSelection]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, app);
      setInputPlaceholder("输入消息...");
    },
    [sendMessage, app],
  );

  return (
    <div className="chat-container">
      <div className="chat-wrapper">
        <MessageList
          messages={messages}
          component={component}
          app={app}
          isLoading={isLoading}
          onSendExample={handleSend}
        />
        <ChatInput
          onSend={handleSend}
          onCancel={abort}
          isLoading={isLoading}
          placeholder={inputPlaceholder}
        />
      </div>
    </div>
  );
}

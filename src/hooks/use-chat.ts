import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "obsidian";
import type { App } from "obsidian";
import type { ApiMessage } from "../types";
import type { ChatDeps } from "../chat/chat-service";
import { ChatOrchestrator } from "../chat/chat-service";

export function useChat(deps: ChatDeps) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const orchestratorRef = useRef<ChatOrchestrator | null>(null);

  useEffect(() => {
    const orchestrator = new ChatOrchestrator(deps, {
      onMessagesChanged: async (msgs) => {
        setMessages([...msgs]);
      },
      onLoadingChanged: (loading) => {
        setIsLoading(loading);
      },
      onNotice: (message) => {
        new Notice(message);
      },
    });
    orchestrator.initialize();
    orchestratorRef.current = orchestrator;
    setMessages([...orchestrator.messages]);

    return () => {
      orchestrator.cleanup();
      orchestratorRef.current = null;
    };
  }, []);

  const sendMessage = useCallback((content: string, app: App) => {
    orchestratorRef.current?.sendMessage(content, app);
  }, []);

  const abort = useCallback(() => {
    orchestratorRef.current?.abort();
  }, []);

  const setPendingSelection = useCallback((selection: string) => {
    orchestratorRef.current?.setPendingSelection(selection);
  }, []);

  return { messages, isLoading, sendMessage, abort, setPendingSelection };
}

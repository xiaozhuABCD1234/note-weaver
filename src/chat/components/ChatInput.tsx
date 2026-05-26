import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onCancel, isLoading, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rowCount = Math.min(Math.max(value.split("\n").length, 1), 6);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClick = useCallback(() => {
    if (isLoading) {
      onCancel();
    } else {
      handleSend();
    }
  }, [isLoading, onCancel, handleSend]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  return (
    <div className="input-wrapper">
      <label htmlFor="chat-input" className="input-label-hidden">
        输入消息
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "输入消息..."}
        disabled={isLoading}
        rows={rowCount}
        aria-label="输入消息"
      />
      <div className="controls-bar">
        <button
          className={`send-button${isLoading ? " is-stop" : ""}`}
          onClick={handleClick}
          aria-label={isLoading ? "停止生成" : "发送消息"}
          aria-busy={isLoading}
          disabled={!isLoading && !value.trim()}
        >
          {isLoading ? (
            <Square size={16} fill="currentColor" strokeWidth={0} />
          ) : (
            <ArrowUp size={18} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
}

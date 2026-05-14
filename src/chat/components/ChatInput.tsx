import { useCallback, useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onCancel, isLoading, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
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
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "输入消息..."}
        disabled={isLoading}
      />
      <button onClick={handleClick}>
        {isLoading ? "取消" : "发送"}
      </button>
    </div>
  );
}

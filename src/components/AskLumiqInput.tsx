"use client";

import { useCallback, useRef, useState } from "react";

interface AskLumiqInputProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

const MAX_ROWS = 3;
const LINE_HEIGHT = 20;

export default function AskLumiqInput({
  onSubmit,
  disabled = false,
}: AskLumiqInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`flex items-end gap-2 rounded-md border-[0.5px] px-2.5 py-2 transition-colors ${
        focused ? "border-[#3a3a3a]" : "border-[#2a2a2a]"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        disabled={disabled}
        placeholder="Hỏi Lumiq về code của bạn..."
        onChange={(e) => {
          setValue(e.target.value);
          resizeTextarea();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        className="max-h-[76px] min-h-[28px] flex-1 resize-none bg-transparent font-sans text-[12px] leading-[1.5] text-[#ccc] placeholder:text-[#444] focus:outline-none disabled:opacity-40"
      />
      <button
        type="button"
        title="Gửi câu hỏi"
        disabled={disabled || !value.trim()}
        onClick={handleSubmit}
        className="shrink-0 rounded px-2 py-1 font-mono text-[11px] text-[#E8E0D0] hover:text-[#fff] disabled:opacity-30"
      >
        ↑
      </button>
    </div>
  );
}

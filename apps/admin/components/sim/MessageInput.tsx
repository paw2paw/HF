'use client';

import { Send } from 'lucide-react';
import { useRef, useCallback } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function MessageInput({ value, onChange, onSend, disabled }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
        // Reset textarea height after send
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onSend();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="wa-input-bar">
      <textarea
        ref={textareaRef}
        className="wa-input-field"
        value={value}
        onChange={(e) => { onChange(e.target.value); handleInput(); }}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        rows={1}
        disabled={disabled}
      />
      <button
        className="wa-send-btn"
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        aria-label="Send message"
      >
        <Send size={20} />
      </button>
    </div>
  );
}

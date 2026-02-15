"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";

interface AskAISearchBarProps {
  placeholder?: string;
  className?: string;
}

export default function AskAISearchBar({
  placeholder = "Ask AI anything...",
  className = "",
}: AskAISearchBarProps) {
  const { openPanel, sendMessage, isOpen } = useChatContext();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMac(/Mac/.test(navigator.platform));
  }, []);

  // If user types and hits enter, open panel and send message
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      openPanel();
      // Small delay to ensure panel is open before sending
      setTimeout(() => {
        sendMessage(query.trim());
        setQuery("");
      }, 100);
    } else {
      openPanel();
    }
  };

  // Handle click on the container (not just input)
  const handleContainerClick = () => {
    if (!isFocused) {
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div
        onClick={handleContainerClick}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl cursor-text
          border transition-all duration-200
          ${isFocused
            ? "border-indigo-400 bg-white dark:bg-neutral-800 shadow-lg shadow-indigo-100 dark:shadow-none ring-2 ring-indigo-100 dark:ring-indigo-900/50"
            : "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-800"
          }
        `}
      >
        {/* AI Icon */}
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-lg transition-colors
          ${isFocused
            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
            : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
          }
        `}>
          <Sparkles className="w-4 h-4" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />

        {/* Keyboard shortcut hint */}
        <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
          {query.trim() ? (
            <button
              type="submit"
              className="px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Send
            </button>
          ) : (
            <>
              <kbd suppressHydrationWarning className="px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-700 rounded border border-neutral-200 dark:border-neutral-600">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-700 rounded border border-neutral-200 dark:border-neutral-600">
                K
              </kbd>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

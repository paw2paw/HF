"use client";

/**
 * CourseRefBuilder — Split-panel chat + live preview for building a COURSE_REFERENCE.
 *
 * Left panel: Chat (sends mode: "COURSE_REF" to /api/chat)
 * Right panel: Live preview of the document being built, section-by-section
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Loader2, ClipboardList, Check, Download, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { CourseRefData } from "@/lib/content-trust/course-ref-to-assertions";
import { RefPreviewPanel } from "./RefPreviewPanel";

// ── Types ────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: { question: string; suggestions: string[] };
}

interface FinalizeResult {
  courseId: string;
  playbookId: string;
  contentSourceId: string;
  assertionCount: number;
}

interface CourseRefBuilderProps {
  courseId?: string;
}

// ── Component ────────────────────────────────────────────

export function CourseRefBuilder({ courseId }: CourseRefBuilderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refData, setRefData] = useState<CourseRefData>({});
  const [finalized, setFinalized] = useState<FinalizeResult | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [courseName, setCourseName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build conversation history for API
  const getConversationHistory = useCallback(() => {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  // Process tool calls from AI response
  const processToolCalls = useCallback(
    (toolCalls: Array<{ name: string; input: Record<string, unknown> }>) => {
      let suggestions: { question: string; suggestions: string[] } | undefined;

      for (const tc of toolCalls) {
        switch (tc.name) {
          case "update_ref": {
            const section = tc.input.section as string;
            const data = tc.input.data as Record<string, unknown>;
            setRefData((prev) => {
              // For top-level sections, merge the data
              if (section === "teachingApproach" && prev.teachingApproach) {
                return { ...prev, [section]: { ...prev.teachingApproach, ...data } };
              }
              return { ...prev, [section]: data };
            });
            break;
          }
          case "show_suggestions": {
            suggestions = {
              question: tc.input.question as string,
              suggestions: tc.input.suggestions as string[],
            };
            break;
          }
          case "finalize_ref": {
            // The result is in the tool response content, parsed by the API
            // We'll catch it from the response JSON
            break;
          }
        }
      }

      return suggestions;
    },
    [],
  );

  // Send message to API
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage.trim(),
            mode: "COURSE_REF",
            entityContext: [],
            conversationHistory: getConversationHistory(),
            setupData: {
              courseRef: refData,
              courseId,
              institutionName,
              courseName,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Process tool calls
        let suggestions: { question: string; suggestions: string[] } | undefined;
        if (data.toolCalls?.length) {
          suggestions = processToolCalls(data.toolCalls);

          // Check for finalize result
          for (const tc of data.toolCalls) {
            if (tc.name === "finalize_ref") {
              // The finalize result comes back in the tool response
              // Parse it from the AI's continuation text or the tool result
              try {
                const input = tc.input as Record<string, unknown>;
                // Extract institution/course names for the finalize call
                if (input.institutionName) setInstitutionName(input.institutionName as string);
                if (input.courseName) setCourseName(input.courseName as string);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        // Check if the response contains a finalize success
        if (data.content?.includes('"ok":true') && data.content?.includes("assertionCount")) {
          try {
            // Try to extract finalize result from the response
            const match = data.content.match(/\{[^}]*"ok"\s*:\s*true[^}]*"assertionCount"\s*:\s*\d+[^}]*\}/);
            if (match) {
              const result = JSON.parse(match[0]);
              if (result.ok && result.assertionCount) {
                setFinalized(result);
              }
            }
          } catch {
            // Not a finalize response
          }
        }

        // Add assistant message
        if (data.content) {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.content,
            suggestions,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }

        // Extract names from update_ref courseOverview
        if (data.toolCalls?.length) {
          for (const tc of data.toolCalls) {
            if (tc.name === "update_ref" && tc.input.section === "courseOverview") {
              const ov = tc.input.data as Record<string, string>;
              if (ov.subject) setCourseName(ov.subject);
            }
          }
        }
      } catch (err) {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: "system",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, getConversationHistory, refData, courseId, institutionName, courseName, processToolCalls],
  );

  // Handle suggestion chip click
  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage],
  );

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // Send initial greeting on mount
  useEffect(() => {
    if (messages.length === 0) {
      sendMessage("Hello, I'd like to build a course reference.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Finalized state ────────────────────────────────────
  if (finalized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-hf-bg">
        <div className="hf-card max-w-lg w-full p-8 text-center space-y-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mx-auto">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-hf-text">Course Created</h2>
          <div className="space-y-2 text-sm text-hf-text-muted">
            {courseName && <p className="font-medium text-hf-text">{courseName}</p>}
            <p>{finalized.assertionCount} teaching assertions in prompt pipeline</p>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href={`/x/get-started-v5?courseId=${finalized.playbookId}`}
              className="hf-btn hf-btn-primary flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Content & Configure
            </a>
            <div className="flex gap-3">
              <a
                href={`/x/courses/${finalized.playbookId}`}
                className="hf-btn hf-btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Course
              </a>
              <button
                className="hf-btn hf-btn-secondary flex-1 flex items-center justify-center gap-2"
                onClick={() => {
                  // TODO: Download markdown
                }}
              >
                <Download className="w-4 h-4" />
                Download Reference
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────
  return (
    <div className="flex h-screen bg-hf-bg">
      {/* Left: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-hf-border">
          <ClipboardList className="w-5 h-5 text-hf-primary" />
          <h1 className="text-lg font-semibold text-hf-text">Course Reference Builder</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-hf-primary text-white"
                    : msg.role === "system"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-hf-surface text-hf-text border border-hf-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    className="prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0"
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Suggestion chips */}
          {messages.length > 0 && messages[messages.length - 1]?.suggestions && (
            <div className="flex flex-wrap gap-2">
              {messages[messages.length - 1].suggestions!.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="px-3 py-1.5 text-sm rounded-full border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-surface-hover transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-hf-surface border border-hf-border rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-hf-text-muted" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-hf-border">
          <div className="flex items-end gap-2 bg-hf-surface border border-hf-border rounded-xl px-4 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your course..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-hf-text placeholder:text-hf-text-muted resize-none outline-none max-h-32"
              style={{ minHeight: "1.5rem" }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-1.5 rounded-lg bg-hf-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hf-primary-hover transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Right: Preview Panel */}
      <div className="w-80 border-l border-hf-border bg-hf-surface overflow-y-auto">
        <RefPreviewPanel refData={refData} />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Trash2, X as XIcon } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import { useEntityContext } from "@/contexts/EntityContext";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import type { LayoutMode } from "@/contexts/AssistantContext";
import { useResponsive } from "@/hooks/useResponsive";

// ============================================================================
// TYPES
// ============================================================================

export type AssistantTab = "chat" | "jobs" | "data" | "spec";
export type AssistantLayout = "popout" | "embedded" | "sidebar";

export interface UnifiedAssistantPanelProps {
  visible?: boolean;
  onClose?: () => void;
  context?: {
    type: "spec" | "parameter" | "domain" | "caller" | "demo";
    data: any;
  };
  location?: {
    page: string;
    section?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
  };
  defaultTab?: AssistantTab;
  layout?: AssistantLayout;
  enabledTabs?: AssistantTab[]; // Allow restricting which tabs are shown
  endpoint?: string; // Custom API endpoint (defaults to /api/ai/assistant)
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: any;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "abandoned";
  taskType: string;
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-1
  blockers?: string[];
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// TAB CONFIGURATION
// ============================================================================

const TAB_CONFIG = {
  chat: {
    label: "Chat",
    icon: "💬",
    description: "Conversational AI assistant",
  },
  jobs: {
    label: "Jobs",
    icon: "✓",
    description: "Active jobs and guidance",
  },
  data: {
    label: "Data",
    icon: "📊",
    description: "Data exploration and queries",
  },
  spec: {
    label: "Spec",
    icon: "📋",
    description: "Spec-specific assistance",
  },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedAssistantPanel({
  visible = false,
  onClose,
  context,
  location,
  defaultTab = "chat",
  layout = "popout",
  enabledTabs = ["chat", "jobs", "data", "spec"],
  endpoint = "/api/ai/assistant",
}: UnifiedAssistantPanelProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [activeTab, setActiveTab] = useState<AssistantTab>(defaultTab);
  const [messages, setMessages] = useState<Record<AssistantTab, ChatMessage[]>>({
    chat: [],
    jobs: [],
    data: [],
    spec: [],
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftInput, setDraftInput] = useState("");
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Initialize panel size from localStorage or defaults
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unifiedAssistant.width');
      return saved ? parseInt(saved, 10) : (layout === 'popout' ? 480 : 360);
    }
    return layout === 'popout' ? 480 : 360;
  });
  const [panelHeight, setPanelHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unifiedAssistant.height');
      return saved ? parseInt(saved, 10) : 600;
    }
    return 600;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chatContext = useChatContext();
  const entityContext = useEntityContext();

  // Try to access global assistant context (optional - only available when used in GlobalAssistant)
  let globalAssistant;
  try {
    globalAssistant = useGlobalAssistant();
  } catch {
    // Not in GlobalAssistant context, that's okay
    globalAssistant = null;
  }

  // Responsive detection for mobile adaptations
  const { isMobile } = useResponsive();

  // Save panel size to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('unifiedAssistant.width', panelWidth.toString());
      localStorage.setItem('unifiedAssistant.height', panelHeight.toString());
    }
  }, [panelWidth, panelHeight]);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // Close layout menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };

    if (layoutMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [layoutMenuOpen]);

  // Welcome message when panel opens
  useEffect(() => {
    if (isVisible && messages.chat.length === 0) {
      const contextName = context?.data?.name || context?.data?.title || context?.data?.slug;
      setMessages((prev) => ({
        ...prev,
        chat: [
          {
            role: "assistant",
            content: `Hi! I'm your HumanFirst AI assistant. ${
              context ? `I can help you with this ${context.type}${contextName ? ` (${contextName})` : ""}.` : "How can I help you today?"
            }`,
            timestamp: new Date(),
          },
        ],
      }));
    }
  }, [isVisible, context]);

  // Load tasks from flash sidebar if available
  useEffect(() => {
    if (isVisible && activeTab === "jobs") {
      loadTasks();
    }
  }, [isVisible, activeTab]);

  const loadTasks = async () => {
    try {
      // Fetch active tasks from API
      const response = await fetch('/api/tasks?status=in_progress');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();

      if (data.ok && data.tasks) {
        // Transform UserTask to UI format
        const tasksData = data.tasks.map((task: any) => ({
          id: task.id,
          title: task.stepTitle || `Step ${task.currentStep}`,
          description: task.stepDescription || '',
          status: task.status === 'completed' ? 'completed' :
                  task.status === 'in_progress' ? 'in_progress' : 'pending',
          taskType: task.taskType,
          currentStep: task.currentStep,
          totalSteps: task.totalSteps,
          progress: task.currentStep / task.totalSteps,
          blockers: task.blockers,
          createdAt: new Date(task.startedAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        }));

        setTasks(tasksData);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      // Show empty state on error
      setTasks([]);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], userMessage],
    }));
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          context,
          location,
          mode: activeTab, // Pass current tab as mode
          history: messages[activeTab].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          suggestions: data.suggestions || data.fieldUpdates,
        };
        setMessages((prev) => ({
          ...prev,
          [activeTab]: [...prev[activeTab], assistantMessage],
        }));
      } else {
        throw new Error(data.error || "Failed to get AI response");
      }
    } catch (error) {
      console.error("AI assistant error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], errorMessage],
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm(`Clear all ${TAB_CONFIG[activeTab].label} messages?`)) {
      setMessages((prev) => ({
        ...prev,
        [activeTab]: [],
      }));
    }
  };

  const handleCopy = () => {
    const content = messages[activeTab]
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(content);
    // TODO: Show toast notification
    console.log("Copied to clipboard!");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      setHistoryIndex(-1);
      setDraftInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const userMessages = messages[activeTab].filter((m) => m.role === "user");

      if (userMessages.length === 0) return;

      // Save current draft if navigating for the first time
      if (historyIndex === -1 && input.trim()) {
        setDraftInput(input);
      }

      const newIndex = Math.min(historyIndex + 1, userMessages.length - 1);
      setHistoryIndex(newIndex);
      setInput(userMessages[userMessages.length - 1 - newIndex].content);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();

      if (historyIndex <= 0) {
        // Return to draft or empty
        setInput(draftInput);
        setHistoryIndex(-1);
        setDraftInput("");
      } else {
        const userMessages = messages[activeTab].filter((m) => m.role === "user");
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(userMessages[userMessages.length - 1 - newIndex].content);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchMode(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        callPoint: `assistant.${activeTab}`,
        limit: "50",
      });

      const response = await fetch(`/api/ai/assistant/search?${params}`);
      const data = await response.json();

      if (data.ok) {
        setSearchResults(data.results || []);
      } else {
        console.error("Search failed:", data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const exitSearchMode = () => {
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    // Extract context around match (±100 chars)
    const start = Math.max(0, index - 100);
    const end = Math.min(text.length, index + query.length + 100);
    const excerpt = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");

    return excerpt;
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, direction: 'width' | 'height' | 'both') => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelWidth;
    const startHeight = panelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      if (direction === 'width' || direction === 'both') {
        const deltaX = startX - e.clientX; // Negative because we're dragging from right
        const newWidth = Math.max(320, Math.min(800, startWidth + deltaX));
        setPanelWidth(newWidth);
      }
      if (direction === 'height' || direction === 'both') {
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(400, Math.min(window.innerHeight - 100, startHeight + deltaY));
        setPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isVisible) return null;

  const layoutStyles = {
    popout: {
      position: "fixed" as const,
      top: 0,
      right: 0,
      bottom: 0,
      width: isMobile ? "100vw" : panelWidth, // Full width on mobile
      zIndex: 1000,
    },
    embedded: {
      width: "100%",
      height: "100%",
      position: "relative" as const,
    },
    sidebar: {
      position: "fixed" as const,
      top: 64,
      right: 16,
      width: panelWidth,
      height: panelHeight,
      zIndex: 999,
    },
  };

  return (
    <>
      {/* Backdrop (only for popout) */}
      {layout === "popout" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(2px)",
            zIndex: 999,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          ...layoutStyles[layout],
          background: "var(--surface-primary)",
          borderLeft: layout === "popout" ? "1px solid var(--border-default)" : "none",
          border: layout === "embedded" ? "1px solid var(--border-default)" : undefined,
          borderRadius: layout === "embedded" ? 12 : undefined,
          boxShadow: layout === "popout" ? "-4px 0 24px rgba(0, 0, 0, 0.15)" : "0 2px 8px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          animation: layout === "popout" ? "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
        }}
      >
        {/* Resize handle (left edge for popout, left+bottom for sidebar) */}
        {layout !== "embedded" && (
          <>
            {/* Left edge resize handle (width) - More visible */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'width')}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: "ew-resize",
                background: "rgba(99, 102, 241, 0.1)",
                borderLeft: "1px solid rgba(99, 102, 241, 0.2)",
                zIndex: 1001,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.3)";
                e.currentTarget.style.borderLeftColor = "rgba(99, 102, 241, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                e.currentTarget.style.borderLeftColor = "rgba(99, 102, 241, 0.2)";
              }}
            >
              {/* Visual grip indicator */}
              <div style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 3,
                height: 30,
                background: "rgba(99, 102, 241, 0.4)",
                borderRadius: 2,
              }} />
            </div>
            {/* Bottom edge resize handle (height, sidebar only) */}
            {layout === "sidebar" && (
              <div
                onMouseDown={(e) => handleResizeStart(e, 'height')}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 8,
                  cursor: "ns-resize",
                  background: "rgba(99, 102, 241, 0.1)",
                  borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
                  zIndex: 1001,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.3)";
                  e.currentTarget.style.borderBottomColor = "rgba(99, 102, 241, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                  e.currentTarget.style.borderBottomColor = "rgba(99, 102, 241, 0.2)";
                }}
              >
                {/* Visual grip indicator */}
                <div style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 30,
                  height: 3,
                  background: "rgba(99, 102, 241, 0.4)",
                  borderRadius: 2,
                }} />
              </div>
            )}
            {/* Corner resize handle (both, sidebar only) */}
            {layout === "sidebar" && (
              <div
                onMouseDown={(e) => handleResizeStart(e, 'both')}
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  width: 16,
                  height: 16,
                  cursor: "nwse-resize",
                  background: "rgba(99, 102, 241, 0.2)",
                  zIndex: 1002,
                  borderRadius: "0 4px 0 0",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.2)";
                }}
              >
                {/* Corner grip icon */}
                <div style={{
                  position: "absolute",
                  right: 3,
                  bottom: 3,
                  fontSize: 10,
                  color: "rgba(99, 102, 241, 0.7)",
                  lineHeight: 1,
                }}>
                  ⋰
                </div>
              </div>
            )}
          </>
        )}
        {/* Header - Compact */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border-default)",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "linear-gradient(135deg, var(--badge-indigo-text, #6366f1) 0%, var(--accent-secondary, #8b5cf6) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                🤖
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  AI Assistant
                </h3>
                {context && (
                  <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {context.type}: {context.data?.name || context.data?.title || context.data?.slug || context.data?.domain || "..."}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {/* Layout mode dropdown (only when in GlobalAssistant context and not mobile) */}
              {globalAssistant && !isMobile && (
                <div ref={layoutMenuRef} style={{ position: "relative", marginRight: 4 }}>
                  <button
                    onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
                    title="Change layout"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: "1px solid var(--border-default)",
                      background: layoutMenuOpen ? "rgba(99, 102, 241, 0.1)" : "var(--surface-secondary)",
                      color: layoutMenuOpen ? "var(--accent-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    ⚙️
                  </button>

                  {/* Dropdown menu */}
                  {layoutMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        width: 180,
                        background: "var(--surface-primary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                        zIndex: 10000,
                        overflow: "hidden",
                      }}
                    >
                      {[
                        { mode: "popout" as LayoutMode, icon: "📌", label: "Popout", desc: "Full overlay" },
                        { mode: "floating" as LayoutMode, icon: "🪟", label: "Floating", desc: "Draggable" },
                        { mode: "docked" as LayoutMode, icon: "📐", label: "Docked", desc: "Corner" },
                        { mode: "minimized" as LayoutMode, icon: "⬇️", label: "Minimize", desc: "Bubble" },
                      ].map(({ mode, icon, label, desc }) => (
                        <button
                          key={mode}
                          onClick={() => {
                            globalAssistant.setLayoutMode(mode);
                            setLayoutMenuOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            background: globalAssistant.layoutMode === mode ? "rgba(99, 102, 241, 0.1)" : "transparent",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontSize: 12,
                            textAlign: "left",
                            transition: "background 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (globalAssistant.layoutMode !== mode) {
                              e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (globalAssistant.layoutMode !== mode) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{label}</div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{desc}</div>
                          </div>
                          {globalAssistant.layoutMode === mode && (
                            <span style={{ fontSize: 10, color: "var(--accent-primary)" }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Compact action buttons */}
              <button
                onClick={handleCopy}
                disabled={messages[activeTab].length === 0}
                title="Copy chat"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border-default)",
                  background: messages[activeTab].length === 0 ? "var(--surface-disabled)" : "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  cursor: messages[activeTab].length === 0 ? "not-allowed" : "pointer",
                  opacity: messages[activeTab].length === 0 ? 0.5 : 1,
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Copy size={12} />
              </button>
              <button
                onClick={handleClear}
                disabled={messages[activeTab].length === 0}
                title="Clear chat"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border-default)",
                  background: messages[activeTab].length === 0 ? "var(--surface-disabled)" : "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  cursor: messages[activeTab].length === 0 ? "not-allowed" : "pointer",
                  opacity: messages[activeTab].length === 0 ? 0.5 : 1,
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={12} />
              </button>
              {layout === "popout" && (
                <button
                  onClick={handleClose}
                  title="Close"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Tabs - Compact */}
          <div style={{ display: "flex", gap: 3 }}>
            {enabledTabs.map((tab) => {
              const config = TAB_CONFIG[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    borderRadius: 4,
                    border: "1px solid",
                    borderColor: isActive ? "var(--accent-primary)" : "var(--border-default)",
                    background: isActive ? "var(--accent-primary)" : "var(--surface-secondary)",
                    color: isActive ? "var(--button-primary-text, #fff)" : "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span style={{ fontSize: 12 }}>{config.icon}</span>
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar - Compact */}
          {activeTab !== "jobs" && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                  padding: 4,
                  transition: "border-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
              >
                <span style={{ fontSize: 11, padding: "2px 4px", color: "var(--text-muted)" }}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Search history..."
                  disabled={isSearching}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 11,
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    padding: "2px 4px",
                  }}
                />
                {searchMode ? (
                  <button
                    onClick={exitSearchMode}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 3,
                      border: "none",
                      background: "var(--surface-secondary)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 10,
                    }}
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || isSearching}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 3,
                      border: "none",
                      background: !searchQuery.trim() || isSearching ? "var(--surface-disabled)" : "var(--accent-primary)",
                      color: !searchQuery.trim() || isSearching ? "var(--text-placeholder)" : "var(--button-primary-text, #fff)",
                      cursor: !searchQuery.trim() || isSearching ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 10,
                    }}
                  >
                    {isSearching ? "..." : "Go"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab Content - Maximized */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* Chat/Data/Spec Tabs - Message View */}
          {(activeTab === "chat" || activeTab === "data" || activeTab === "spec") && (
            <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Search Mode - Display Results */}
              {searchMode ? (
                <>
                  <div style={{
                    padding: "8px 12px",
                    background: "rgba(99, 102, 241, 0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}>
                    Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </div>
                  {searchResults.length === 0 ? (
                    <div style={{
                      padding: 32,
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}>
                      No previous conversations found matching "{searchQuery}"
                    </div>
                  ) : (
                    searchResults.map((result, i) => (
                      <div
                        key={result.id}
                        style={{
                          padding: 12,
                          background: "var(--surface-secondary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 10,
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {/* User message */}
                        {result.userMatchIndex >= 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
                              You asked:
                            </div>
                            <div style={{ color: "var(--text-primary)" }}>
                              {highlightText(result.userMessage, searchQuery)}
                            </div>
                          </div>
                        )}

                        {/* AI response */}
                        {result.aiMatchIndex >= 0 && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
                              Assistant replied:
                            </div>
                            <div style={{ color: "var(--text-primary)" }}>
                              {highlightText(result.aiResponse, searchQuery)}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: "1px solid var(--border-default)",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--text-placeholder)",
                        }}>
                          <span>{new Date(result.timestamp).toLocaleString()}</span>
                          <span style={{
                            padding: "2px 6px",
                            background: "rgba(99, 102, 241, 0.15)",
                            borderRadius: 4,
                            color: "var(--accent-primary)",
                            fontWeight: 600,
                          }}>
                            {result.callPoint.replace("assistant.", "")}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                /* Regular Chat Mode - Display Current Messages */
                <>
                  {messages[activeTab].map((message, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: message.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background:
                        message.role === "user"
                          ? "linear-gradient(135deg, var(--badge-indigo-text, #6366f1) 0%, var(--accent-secondary, #8b5cf6) 100%)"
                          : "var(--surface-secondary)",
                      color: message.role === "user" ? "var(--text-on-dark, #fff)" : "var(--text-primary)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      border: message.role === "assistant" ? "1px solid var(--border-default)" : "none",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {message.content}
                  </div>

                  {message.suggestions && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 12,
                        background: "rgba(99, 102, 241, 0.05)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        borderRadius: 8,
                        maxWidth: "85%",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                        💡 SUGGESTED CHANGES
                      </div>
                      <pre
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          background: "var(--surface-primary)",
                          padding: 8,
                          borderRadius: 6,
                          overflow: "auto",
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(message.suggestions, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div style={{ fontSize: 9, color: "var(--text-placeholder)", marginTop: 4 }}>
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}

                  {loading && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 14px",
                        background: "var(--surface-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                        maxWidth: "85%",
                        fontSize: 13,
                        color: "var(--text-muted)",
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid var(--border-default)",
                          borderTopColor: "var(--accent-primary)",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Thinking...
                    </div>
                  )}
                </>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Jobs Tab - Job List View */}
          {activeTab === "jobs" && (
            <div style={{ flex: 1, padding: "16px 20px" }}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Active Jobs
                </h4>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  Track your progress and follow AI guidance
                </p>
              </div>

              {tasks.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  No active tasks. Start a conversation to get guidance!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        padding: 12,
                        background: "var(--surface-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surface-tertiary)";
                        e.currentTarget.style.borderColor = "var(--accent-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--surface-secondary)";
                        e.currentTarget.style.borderColor = "var(--border-default)";
                      }}
                    >
                      {/* Progress bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                          <span>Step {task.currentStep} of {task.totalSteps}</span>
                          <span>{Math.round(task.progress * 100)}%</span>
                        </div>
                        <div style={{ height: 4, background: "var(--border-default)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            width: `${task.progress * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--accent-secondary, #8b5cf6), var(--badge-indigo-text, #6366f1))',
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>

                      {/* Task info */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: "2px solid",
                            borderColor:
                              task.status === "completed"
                                ? "var(--status-success-text)"
                                : task.status === "abandoned"
                                ? "var(--status-error-text)"
                                : task.status === "in_progress"
                                ? "var(--status-warning-text)"
                                : "var(--border-default)",
                            background:
                              task.status === "completed"
                                ? "var(--status-success-text)"
                                : task.status === "abandoned"
                                ? "var(--status-error-text)"
                                : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--button-primary-text, #fff)",
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                        >
                          {task.status === "completed" && "✓"}
                          {task.status === "abandoned" && "✕"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              marginBottom: 4,
                            }}
                          >
                            {task.title}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{task.description}</div>
                          )}

                          {/* Task type badge */}
                          <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {task.taskType.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>

                      {/* Blockers */}
                      {task.blockers && task.blockers.length > 0 && (
                        <div style={{ marginTop: 10, padding: 8, background: "color-mix(in srgb, var(--status-error-text) 10%, transparent)", borderRadius: 6, border: "1px solid color-mix(in srgb, var(--status-error-text) 20%, transparent)" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--status-error-text)", marginBottom: 4 }}>
                            ⚠️ {task.blockers.length} Blocker{task.blockers.length > 1 ? 's' : ''}
                          </div>
                          {task.blockers.map((blocker, i) => (
                            <div key={i} style={{ fontSize: 10, color: "var(--status-error-text)", marginLeft: 16 }}>
                              • {blocker}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Input Only (Compact) */}
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
          }}
        >

          {/* Input (only for chat tabs, not jobs) */}
          {activeTab !== "jobs" && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: 4,
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  disabled={loading}
                  rows={1}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    resize: "none",
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    padding: "4px 6px",
                    minHeight: 22,
                    maxHeight: 100,
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "22px";
                    target.style.height = target.scrollHeight + "px";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    border: "none",
                    background: !input.trim() || loading ? "var(--surface-disabled)" : "var(--accent-primary)",
                    color: !input.trim() || loading ? "var(--text-placeholder)" : "var(--button-primary-text, #fff)",
                    cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  ↵
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 8, color: "var(--text-placeholder)", textAlign: "center" }}>
                Enter=send • Shift+Enter=newline • ↑↓=history
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

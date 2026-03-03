"use client";

/**
 * AIConversationWizard — AI-driven conversational onboarding for Get Started V2.
 *
 * The AI drives the conversation via tool calls:
 *   - update_setup → saves data, updates ScaffoldPanel
 *   - show_options / show_sliders / show_upload / show_actions → renders OptionPanel above input bar
 *   - create_institution / create_course → triggers server-side creation
 *   - mark_complete → signals done
 *
 * Uses /api/chat with mode=WIZARD (non-streaming, returns JSON with content + toolCalls).
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useStepFlow } from "@/contexts/StepFlowContext";
import type { StepDefinition } from "@/contexts/StepFlowContext";
import { PackUploadStep } from "@/components/wizards/PackUploadStep";
import type { PackUploadResult } from "@/components/wizards/PackUploadStep";
import { ScaffoldPanel } from "../../get-started/components/ScaffoldPanel";
import { OptionPanel, type PanelConfig, type TabDef, type OptionDef, type SlidersPanel } from "./OptionPanel";
import "../get-started-v2.css";

// ── Types ────────────────────────────────────────────────

interface Message {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  systemType?: "timeline" | "success" | "error";
}

interface WizardToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface WizardResponse {
  content: string;
  toolCalls: WizardToolCall[];
  toolCallCount: number;
}

// ── Step defs for StepFlowContext ────────────────────────

const WIZARD_STEPS: StepDefinition[] = [
  { id: "institution", label: "Organisation", activeLabel: "Setting up organisation" },
  { id: "course", label: "Course", activeLabel: "Configuring course" },
  { id: "content", label: "Content", activeLabel: "Adding content" },
  { id: "welcome", label: "Welcome", activeLabel: "Writing welcome message" },
  { id: "tune", label: "Fine-Tune", activeLabel: "Tuning personality" },
  { id: "launch", label: "Launch", activeLabel: "Launching course" },
];

// ── Storage key ─────────────────────────────────────────

const HISTORY_KEY = "gs-v2-history";

function loadHistory(): Message[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch { /* ignore quota errors */ }
}

// ── Unique ID helper ────────────────────────────────────

let idCounter = 0;
function uid(): string {
  return `msg-${Date.now()}-${++idCounter}`;
}

// ── Component ───────────────────────────────────────────

export function AIConversationWizard() {
  const { getData, setData, isActive, startFlow } = useStepFlow();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelConfig[] | null>(null);
  const [activeTabs, setActiveTabs] = useState<TabDef[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialised = useRef(false);

  // ── Scroll to bottom ────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // ── Derive setup data from StepFlowContext ──────────────

  const getSetupData = useCallback((): Record<string, unknown> => {
    const keys = [
      "institutionName", "existingInstitutionId", "existingDomainId",
      "typeSlug", "defaultDomainKind", "websiteUrl",
      "courseName", "subjectDiscipline", "interactionPattern", "teachingMode",
      "welcomeMessage", "sessionCount", "durationMins", "planEmphasis",
      "behaviorTargets", "lessonPlanModel",
      "draftDomainId", "draftInstitutionId", "draftPlaybookId", "draftCallerId",
      "launched", "sourceId", "packSubjectIds", "extractionTotals",
    ];
    const data: Record<string, unknown> = {};
    for (const k of keys) {
      const v = getData(k);
      if (v !== undefined && v !== null && v !== "") data[k] = v;
    }
    return data;
  }, [getData]);

  // ── Send message to API ─────────────────────────────────

  const sendToAPI = useCallback(
    async (userMessage: string, history: Message[]): Promise<WizardResponse | null> => {
      try {
        const conversationHistory = history
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            mode: "WIZARD",
            entityContext: [],
            conversationHistory,
            setupData: getSetupData(),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        return await res.json();
      } catch (err) {
        console.error("[wizard] API error:", err);
        return null;
      }
    },
    [getSetupData],
  );

  // ── Process tool calls from AI response ─────────────────

  const processToolCalls = useCallback(
    (toolCalls: WizardToolCall[]) => {
      const panels: PanelConfig[] = [];
      const tabs: TabDef[] = [];

      for (const tc of toolCalls) {
        switch (tc.name) {
          case "update_setup": {
            const fields = tc.input.fields as Record<string, unknown>;
            for (const [k, v] of Object.entries(fields)) {
              setData(k, v);
            }
            // Update step estimate based on what we know
            if (fields.courseName || fields.interactionPattern) setCurrentStep(1);
            if (fields.welcomeMessage || fields.sessionCount) setCurrentStep(3);
            if (fields.behaviorTargets || fields.lessonPlanModel) setCurrentStep(4);
            break;
          }

          case "show_options": {
            const panel: PanelConfig = {
              type: "options",
              question: tc.input.question as string,
              dataKey: tc.input.dataKey as string,
              mode: (tc.input.mode as "radio" | "checklist") || "radio",
              options: (tc.input.options as OptionDef[]) || [],
            };
            const tab = tc.input.tab as string | undefined;
            if (tab) {
              tabs.push({ id: tab, label: tab, panel });
            } else {
              panels.push(panel);
            }
            break;
          }

          case "show_sliders": {
            const panel: PanelConfig = {
              type: "sliders",
              question: tc.input.question as string,
              sliders: (tc.input.sliders as SlidersPanel["sliders"]) || [],
            };
            const tab = tc.input.tab as string | undefined;
            if (tab) {
              tabs.push({ id: tab, label: tab, panel });
            } else {
              panels.push(panel);
            }
            break;
          }

          case "show_upload": {
            panels.push({
              type: "upload",
              question: tc.input.question as string || "Upload teaching materials",
            });
            break;
          }

          case "show_actions": {
            panels.push({
              type: "actions",
              question: tc.input.question as string,
              primary: tc.input.primary as { label: string; icon?: string },
              secondary: tc.input.secondary as { label: string; icon?: string },
            });
            break;
          }

          case "create_institution": {
            // Result already handled server-side — parse result for IDs
            // (The tool result comes back in the AI's tool loop, not here)
            break;
          }

          case "create_course": {
            break;
          }

          case "mark_complete": {
            setData("launched", true);
            setCurrentStep(5);
            break;
          }
        }
      }

      // Set panels (tabs take priority)
      if (tabs.length > 0) {
        setActiveTabs(tabs);
        setActivePanel(null);
      } else if (panels.length > 0) {
        setActivePanel(panels);
        setActiveTabs(null);
      }

      // Extract creation results from tool calls
      for (const tc of toolCalls) {
        if (tc.name === "create_institution" || tc.name === "create_course") {
          // These are processed server-side and fed back to the AI.
          // We need to check if the AI's response text mentions success
          // and parse any IDs from the content.
        }
      }
    },
    [setData],
  );

  // ── Send user message ───────────────────────────────────

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || inputValue).trim();
      if (!msg || isLoading) return;

      setInputValue("");
      setActivePanel(null);
      setActiveTabs(null);

      // Add user message
      const userMsg: Message = { id: uid(), role: "user", content: msg };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      saveHistory(newMessages);
      scrollToBottom();

      // Call API
      setIsLoading(true);
      const response = await sendToAPI(msg, newMessages);
      setIsLoading(false);

      if (!response) {
        const errMsg: Message = {
          id: uid(),
          role: "system",
          content: "Something went wrong. Please try again.",
          systemType: "error",
        };
        const withErr = [...newMessages, errMsg];
        setMessages(withErr);
        saveHistory(withErr);
        scrollToBottom();
        return;
      }

      // Process tool calls (updates data, sets panels)
      if (response.toolCalls?.length > 0) {
        processToolCalls(response.toolCalls);
      }

      // Add AI response
      if (response.content) {
        const aiMsg: Message = { id: uid(), role: "assistant", content: response.content };
        const withAi = [...newMessages, aiMsg];
        setMessages(withAi);
        saveHistory(withAi);
        scrollToBottom();
      }

      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [inputValue, isLoading, messages, sendToAPI, processToolCalls, scrollToBottom],
  );

  // ── Handle option panel submission ──────────────────────

  const handlePanelSubmit = useCallback(
    (dataKey: string, value: unknown, displayText: string) => {
      setData(dataKey, value);
      setActivePanel(null);
      setActiveTabs(null);
      // Send the selection as a user message so the AI knows
      handleSend(displayText);
    },
    [setData, handleSend],
  );

  // ── Handle action buttons ───────────────────────────────

  const handleAction = useCallback(
    (action: "primary" | "secondary") => {
      setActivePanel(null);
      setActiveTabs(null);
      const text = action === "primary" ? "Create & Try a Call" : "Continue Setup";
      handleSend(text);
    },
    [handleSend],
  );

  // ── Handle upload complete ──────────────────────────────

  const handleUploadComplete = useCallback(
    (result: PackUploadResult) => {
      if (result.subjects) {
        setData("packSubjectIds", result.subjects.map((s) => s.id));
      }
      if (result.extractionTotals) setData("extractionTotals", result.extractionTotals);
      if (result.taskId) setData("uploadTaskId", result.taskId);
      setActivePanel(null);
      handleSend("Teaching materials uploaded");
    },
    [setData, handleSend],
  );

  // ── Keyboard handler ────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Start flow on mount ─────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      startFlow({
        flowId: "get-started-v2",
        steps: WIZARD_STEPS,
        returnPath: "/x/get-started-v2",
      });
    }
  }, [isActive, startFlow]);

  // ── Initialise: restore history or send greeting ────────

  useEffect(() => {
    if (!isActive || initialised.current) return;
    initialised.current = true;

    const saved = loadHistory();
    if (saved.length > 0) {
      setMessages(saved);
      scrollToBottom();
      return;
    }

    // Send initial greeting
    (async () => {
      setIsLoading(true);
      const response = await sendToAPI(
        "(User just opened the wizard. Give a warm greeting and ask what they'd like to set up.)",
        [],
      );
      setIsLoading(false);

      if (response?.content) {
        const greeting: Message = { id: uid(), role: "assistant", content: response.content };
        setMessages([greeting]);
        saveHistory([greeting]);
        scrollToBottom();
      }

      if (response?.toolCalls?.length) {
        processToolCalls(response.toolCalls);
      }
    })();
  }, [isActive, sendToAPI, processToolCalls, scrollToBottom]);

  // ── Render ────────────────────────────────────────────

  if (!isActive) return null;

  const setupData = getSetupData();
  const draftCallerId = getData<string>("draftCallerId");

  return (
    <div className="gs-layout">
      <div className="gs-main">
        <div className="gs-chat-container">
          {/* Messages */}
          <div className="gs-chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`gs-chat-row gs-chat-row--${msg.role}`}>
                {msg.systemType === "error" ? (
                  <div className="gs-chat-bubble gs-chat-bubble--system" style={{ borderColor: "var(--status-error-text)" }}>
                    {msg.content}
                  </div>
                ) : msg.role === "system" ? (
                  <div className="gs-chat-bubble gs-chat-bubble--system">{msg.content}</div>
                ) : (
                  <div className={`gs-chat-bubble gs-chat-bubble--${msg.role}`}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="gs-chat-row gs-chat-row--assistant">
                <div className="gs-chat-typing">
                  <div className="gs-chat-typing-dot" />
                  <div className="gs-chat-typing-dot" />
                  <div className="gs-chat-typing-dot" />
                </div>
              </div>
            )}

            {/* Success card when complete */}
            {getData<boolean>("launched") && draftCallerId && (
              <div className="gs-chat-row gs-chat-row--system">
                <div className="gs-chat-bubble gs-chat-bubble--system">
                  <div className="gs-chat-success">
                    <div className="gs-chat-success-title">Your AI tutor is ready!</div>
                    <div className="gs-chat-success-sub">Try a sim call to see it in action.</div>
                    <div className="gs-chat-success-actions">
                      <a href={`/x/sim/${draftCallerId}`} className="hf-btn hf-btn-primary">
                        Try a Sim Call
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="gs-chat-input-bar">
            {/* Zone 0: Option Panel (above input) */}
            {activeTabs && (
              <OptionPanel
                panels={activeTabs}
                tabbed
                onSubmit={handlePanelSubmit}
                onAction={handleAction}
                uploadComponent={
                  <PackUploadStep
                    domainId={getData<string>("draftDomainId") || getData<string>("existingDomainId") || ""}
                    courseName={getData<string>("courseName") || "Course"}
                    interactionPattern={getData<string>("interactionPattern") || undefined}
                    teachingMode={getData<string>("teachingMode") || undefined}
                    subjectDiscipline={getData<string>("subjectDiscipline") || undefined}
                    onResult={handleUploadComplete}
                  />
                }
              />
            )}
            {activePanel && !activeTabs && (
              <OptionPanel
                panels={activePanel}
                onSubmit={handlePanelSubmit}
                onAction={handleAction}
                uploadComponent={
                  <PackUploadStep
                    domainId={getData<string>("draftDomainId") || getData<string>("existingDomainId") || ""}
                    courseName={getData<string>("courseName") || "Course"}
                    interactionPattern={getData<string>("interactionPattern") || undefined}
                    teachingMode={getData<string>("teachingMode") || undefined}
                    subjectDiscipline={getData<string>("subjectDiscipline") || undefined}
                    onResult={handleUploadComplete}
                  />
                }
              />
            )}

            {/* Zone 1: Typing area */}
            <div className="gs-chat-input-zone">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="gs-chat-textarea"
                disabled={isLoading}
              />
            </div>

            {/* Zone 2: Controls bar */}
            <div className="gs-chat-controls-bar">
              <div className="gs-chat-controls-left">
                {isLoading && (
                  <span className="gs-chat-step-counter">
                    <Loader2 size={12} className="hf-spinner" style={{ display: "inline" }} />
                    {" "}Thinking...
                  </span>
                )}
              </div>
              <div className="gs-chat-controls-right">
                <button
                  type="button"
                  className="gs-chat-send-btn"
                  disabled={!inputValue.trim() || isLoading}
                  onClick={() => handleSend()}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scaffold panel */}
      <ScaffoldPanel getData={getData} currentStepIndex={currentStep} />
    </div>
  );
}

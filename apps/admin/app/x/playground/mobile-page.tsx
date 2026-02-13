"use client";

import { useState, useEffect } from "react";
import { DesktopModeToggle } from "@/components/shared/DesktopModeToggle";
import { ChevronDown, ChevronUp, Play, RefreshCw, Settings as SettingsIcon } from "lucide-react";

/**
 * Playground Mobile Page - "Playground in Miniature"
 *
 * Core features:
 * - Caller selector
 * - Generate prompt
 * - Simulate call
 * - Settings panel
 * - Re-prompt
 * - See differences
 */

type CallerSummary = {
  id: string;
  name: string | null;
  email: string | null;
  domain: { name: string } | null;
};

type GeneratedPrompt = {
  id: string;
  prompt: string;
};

export default function PlaygroundMobilePage() {
  const [callers, setCallers] = useState<CallerSummary[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [userInput, setUserInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);

  // Fetch callers on mount
  useEffect(() => {
    fetchCallers();
  }, []);

  const fetchCallers = async () => {
    try {
      const res = await fetch("/api/callers");
      const data = await res.json();
      if (data.ok) {
        setCallers(data.callers || []);
        // Auto-select first caller
        if (data.callers && data.callers.length > 0) {
          setSelectedCallerId(data.callers[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch callers:", error);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!selectedCallerId) {
      alert("Please select a caller first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.ok) {
        setGeneratedPrompt({
          id: data.id || "generated",
          prompt: data.prompt || "",
        });
        setPromptExpanded(true);
      } else {
        alert(`Error: ${data.error || "Failed to generate prompt"}`);
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error);
      alert("Failed to generate prompt");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCall = async () => {
    if (!userInput.trim()) {
      alert("Please enter a message");
      return;
    }

    if (!generatedPrompt) {
      alert("Please generate a prompt first");
      return;
    }

    setLoading(true);
    setAiResponse("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          systemPrompt: generatedPrompt.prompt,
          temperature,
          maxTokens,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAiResponse(data.response || "");
      } else {
        setAiResponse(`Error: ${data.error || "Failed to get response"}`);
      }
    } catch (error) {
      console.error("Failed to simulate call:", error);
      setAiResponse("Failed to simulate call");
    } finally {
      setLoading(false);
    }
  };

  const handleRePrompt = () => {
    // Re-generate prompt with same caller
    handleGeneratePrompt();
  };

  const selectedCaller = callers.find((c) => c.id === selectedCallerId);

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* Desktop mode toggle */}
      <DesktopModeToggle />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Playground
        </h1>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Mobile
        </div>
      </div>

      {/* Caller Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Select Caller
        </label>
        <select
          value={selectedCallerId}
          onChange={(e) => setSelectedCallerId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">Choose a caller...</option>
          {callers.map((caller) => (
            <option key={caller.id} value={caller.id}>
              {caller.name || caller.email || `Caller ${caller.id.slice(0, 8)}`}
              {caller.domain && ` (${caller.domain.name})`}
            </option>
          ))}
        </select>
      </div>

      {/* Generate Prompt Button */}
      <button
        onClick={handleGeneratePrompt}
        disabled={!selectedCallerId || loading}
        className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors"
        style={{
          background: !selectedCallerId || loading ? "var(--button-disabled-bg)" : "var(--button-primary-bg)",
          opacity: !selectedCallerId || loading ? 0.6 : 1,
          cursor: !selectedCallerId || loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Generate Prompt
          </>
        )}
      </button>

      {/* Prompt Preview (Collapsible) */}
      {generatedPrompt && (
        <div className="flex flex-col rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
          <button
            onClick={() => setPromptExpanded(!promptExpanded)}
            className="flex items-center justify-between px-4 py-3 transition-colors"
            style={{
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
            }}
          >
            <span className="text-sm font-semibold">System Prompt</span>
            {promptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {promptExpanded && (
            <div
              className="px-4 py-3 text-xs font-mono overflow-auto max-h-60"
              style={{
                background: "var(--surface-primary)",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {generatedPrompt.prompt}
            </div>
          )}
        </div>
      )}

      {/* Call Simulation */}
      {generatedPrompt && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Simulate Call
          </label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleSimulateCall}
            disabled={!userInput.trim() || loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            style={{
              background: !userInput.trim() || loading ? "var(--button-disabled-bg)" : "var(--button-success-bg)",
              opacity: !userInput.trim() || loading ? 0.6 : 1,
              cursor: !userInput.trim() || loading ? "not-allowed" : "pointer",
            }}
          >
            <Play className="w-4 h-4" />
            Send
          </button>
        </div>
      )}

      {/* AI Response */}
      {aiResponse && (
        <div className="flex flex-col gap-2 p-4 rounded-lg" style={{ background: "var(--surface-secondary)" }}>
          <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            AI Response
          </div>
          <div className="text-sm" style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {aiResponse}
          </div>
        </div>
      )}

      {/* Re-Prompt Button */}
      {generatedPrompt && (
        <button
          onClick={handleRePrompt}
          disabled={loading}
          className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            background: "var(--surface-secondary)",
            color: "var(--accent-primary)",
            border: "1px solid var(--border-default)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Re-Generate Prompt
        </button>
      )}

      {/* Settings Panel (Collapsible) */}
      <div className="flex flex-col rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
        <button
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="flex items-center justify-between px-4 py-3 transition-colors"
          style={{
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">Settings</span>
          </div>
          {settingsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {settingsExpanded && (
          <div className="px-4 py-3 flex flex-col gap-4" style={{ background: "var(--surface-primary)" }}>
            {/* Temperature */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Temperature
                </label>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {temperature}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Max Tokens */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Max Tokens
                </label>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {maxTokens}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--text-secondary)" }}>
        <p className="mb-1 font-semibold" style={{ color: "var(--accent-primary)" }}>
          💡 Mobile Playground
        </p>
        <p>Simplified view for quick prompt generation and testing. For advanced features, switch to Desktop Mode above.</p>
      </div>
    </div>
  );
}

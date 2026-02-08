"use client";

import { useState, useEffect, useCallback } from "react";

type RunConfig = {
  id: string;
  name: string;
  description: string | null;
  version: string;
  status: "DRAFT" | "COMPILING" | "READY" | "ERROR" | "SUPERSEDED";
  measureSpecCount: number;
  learnSpecCount: number;
  parameterCount: number;
};

type AnalysisResult = {
  ok: boolean;
  model: string;
  analysisTime: number;
  usage: {
    measureTokens: { inputTokens: number; outputTokens: number } | null;
    learnTokens: { inputTokens: number; outputTokens: number } | null;
  };
  measures: Record<string, number>;
  learned: Array<{ category: string; key: string; value: string; evidence: string }>;
  summary: {
    specsAnalyzed: number;
    measureSpecs: number;
    learnSpecs: number;
    parametersScored: number;
    factsLearned: number;
  };
};

const SAMPLE_TRANSCRIPTS = [
  {
    name: "Friendly Customer Call",
    transcript: `Agent: Good morning! Thank you for calling. How can I help you today?
Customer: Hi! I'm calling about my account. I've been a customer for about 3 years now.
Agent: Great, I appreciate your loyalty! What can I assist you with?
Customer: Well, I recently moved from London to Manchester, and I need to update my address.
Agent: No problem at all. Can I verify your information first?
Customer: Sure! My name is Sarah Johnson and my email is sarah.johnson@email.com.
Agent: Perfect. I can see your account. I'll update the address to Manchester now.
Customer: That's wonderful. Also, I'd prefer to receive updates via email rather than phone calls.
Agent: Noted! I'll update your communication preferences. Is there anything else?
Customer: No, that's all. You've been very helpful. Have a great day!
Agent: Thank you, Sarah! Enjoy your day in Manchester!`,
  },
  {
    name: "Technical Support Call",
    transcript: `Agent: Technical support, how can I help?
Customer: My internet isn't working. It's been down for two hours now.
Agent: I'm sorry to hear that. Let me look into this for you.
Customer: I've already tried restarting the router twice.
Agent: Good thinking. Can you tell me if any lights are on?
Customer: The power light is on but the internet light is blinking red.
Agent: That indicates a connection issue on our end. Let me check the service status.
Customer: This is frustrating. I work from home and I have a meeting in 30 minutes.
Agent: I completely understand. I can see there's maintenance in your area.
Customer: How long will it take?
Agent: It should be resolved within the hour. Would you like a text when it's back?
Customer: Yes, please text me at this number.
Agent: Done. I've also added a credit to your account for the inconvenience.
Customer: Thank you, that helps.`,
  },
  {
    name: "Sales Inquiry",
    transcript: `Agent: Hello, sales department. How can I help you today?
Customer: Hi, I'm interested in your premium subscription plan.
Agent: Excellent choice! What would you like to know?
Customer: What's included and how much does it cost?
Agent: The premium plan is $29.99 per month and includes unlimited storage, priority support, and advanced analytics.
Customer: That sounds good. I run a small marketing agency with about 10 employees.
Agent: Perfect! We also have a team plan that might suit you better - $199 per month for up to 20 users.
Customer: Oh interesting. We're based in San Francisco and collaboration is important to us.
Agent: The team plan has real-time collaboration features built in. Would you like a demo?
Customer: Yes, I'd love that. Can you schedule one for next Tuesday?
Agent: Absolutely! What time works for you? And should I send the invite to this number?
Customer: 2 PM Pacific time would be great. And yes, please email me at mike@agencyname.com
Agent: All set! You'll receive a calendar invite shortly. Looking forward to showing you the platform.
Customer: Thanks, talk to you Tuesday!`,
  },
];

export default function AnalysisTestPage() {
  const [runConfigs, setRunConfigs] = useState<RunConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [transcript, setTranscript] = useState<string>(SAMPLE_TRANSCRIPTS[0].transcript);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>("claude-3-haiku-20240307");

  // Fetch run configs
  const fetchRunConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/compiled-sets?status=READY");
      const data = await res.json();
      if (data.ok) {
        setRunConfigs(data.sets || []);
        if (data.sets?.length > 0) {
          setSelectedConfigId(data.sets[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load run configs:", err);
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    fetchRunConfigs();
  }, [fetchRunConfigs]);

  // Run analysis
  const handleRunAnalysis = async () => {
    if (!transcript.trim()) {
      setError("Please enter a transcript to analyse");
      return;
    }

    setAnalysing(true);
    setError(null);
    setResult(null);

    try {
      // Get spec slugs from config if selected
      let specSlugs: string[] | undefined;

      if (selectedConfigId) {
        const configRes = await fetch(`/api/compiled-sets/${selectedConfigId}`);
        const configData = await configRes.json();
        if (configData.ok) {
          specSlugs = [
            ...(configData.specs?.measure || []).map((s: any) => s.slug),
            ...(configData.specs?.learn || []).map((s: any) => s.slug),
          ];
        }
      }

      const res = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          specs: specSlugs?.length ? specSlugs : undefined,
          model,
          storeResults: false, // Don't store in test mode
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  // Load sample transcript
  const loadSample = (sample: typeof SAMPLE_TRANSCRIPTS[0]) => {
    setTranscript(sample.transcript);
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Analysis Test</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Test the analysis pipeline with sample or custom transcripts
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: Input */}
        <div>
          {/* Sample Transcripts */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Sample Transcripts
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SAMPLE_TRANSCRIPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => loadSample(sample)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    background: transcript === sample.transcript ? "#4f46e5" : "#f3f4f6",
                    color: transcript === sample.transcript ? "white" : "#374151",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Run Config Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Run Config
            </label>
            {loadingConfigs ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Loading...</div>
            ) : runConfigs.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  background: "#fef3c7",
                  border: "1px solid #fbbf24",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                No READY run configs. Will use all active specs.
              </div>
            ) : (
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                }}
              >
                <option value="">All active specs</option>
                {runConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name} (v{config.version}) – {config.measureSpecCount}M / {config.learnSpecCount}L
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Model Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: "1px solid #d1d5db",
                borderRadius: 8,
              }}
            >
              <option value="claude-3-haiku-20240307">Claude 3 Haiku (fast, cheap)</option>
              <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (balanced)</option>
              <option value="claude-3-opus-20240229">Claude 3 Opus (best quality)</option>
            </select>
          </div>

          {/* Transcript Input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Transcript
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste a call transcript here..."
              style={{
                width: "100%",
                height: 300,
                padding: 12,
                fontSize: 13,
                fontFamily: "monospace",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                resize: "vertical",
              }}
            />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              {transcript.length} characters
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: 12,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#dc2626",
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={handleRunAnalysis}
            disabled={analysing || !transcript.trim()}
            style={{
              width: "100%",
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              background: analysing || !transcript.trim() ? "#9ca3af" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: analysing || !transcript.trim() ? "not-allowed" : "pointer",
            }}
          >
            {analysing ? "Analysing..." : "Run Analysis"}
          </button>
        </div>

        {/* Right: Results */}
        <div>
          {result ? (
            <div>
              {/* Summary Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
                    {result.summary.parametersScored}
                  </div>
                  <div style={{ fontSize: 12, color: "#166534" }}>Parameters Scored</div>
                </div>
                <div style={{ background: "#fef3c7", padding: 16, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
                    {result.summary.factsLearned}
                  </div>
                  <div style={{ fontSize: 12, color: "#92400e" }}>Facts Learned</div>
                </div>
                <div style={{ background: "#ede9fe", padding: 16, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>
                    {result.analysisTime}ms
                  </div>
                  <div style={{ fontSize: 12, color: "#5b21b6" }}>Analysis Time</div>
                </div>
              </div>

              {/* Token Usage */}
              <div
                style={{
                  background: "#f3f4f6",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <strong>Token Usage:</strong>{" "}
                {result.usage.measureTokens && (
                  <span style={{ marginRight: 16 }}>
                    Measure: {result.usage.measureTokens.inputTokens} in / {result.usage.measureTokens.outputTokens} out
                  </span>
                )}
                {result.usage.learnTokens && (
                  <span>
                    Learn: {result.usage.learnTokens.inputTokens} in / {result.usage.learnTokens.outputTokens} out
                  </span>
                )}
              </div>

              {/* Measures */}
              {Object.keys(result.measures).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    Measures ({Object.keys(result.measures).length})
                  </h3>
                  <div
                    style={{
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {Object.entries(result.measures).map(([paramId, score], idx) => (
                      <div
                        key={paramId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 12px",
                          borderBottom: idx < Object.keys(result.measures).length - 1 ? "1px solid #f3f4f6" : "none",
                        }}
                      >
                        <div style={{ flex: 1, fontSize: 13 }}>{paramId}</div>
                        <div
                          style={{
                            width: 100,
                            height: 8,
                            background: "#e5e7eb",
                            borderRadius: 4,
                            overflow: "hidden",
                            marginRight: 12,
                          }}
                        >
                          <div
                            style={{
                              width: `${(score as number) * 100}%`,
                              height: "100%",
                              background:
                                (score as number) >= 0.7
                                  ? "#22c55e"
                                  : (score as number) >= 0.4
                                  ? "#eab308"
                                  : "#ef4444",
                              borderRadius: 4,
                            }}
                          />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, width: 50, textAlign: "right" }}>
                          {((score as number) * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learned Facts */}
              {result.learned.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    Learned Facts ({result.learned.length})
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.learned.map((fact, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 8px",
                              background: "#fbbf24",
                              color: "#78350f",
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            {fact.category}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{fact.key}</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#374151" }}>{fact.value}</div>
                        {fact.evidence && (
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>
                            Evidence: "{fact.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {Object.keys(result.measures).length === 0 && result.learned.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    background: "#f9fafb",
                    borderRadius: 8,
                    color: "#6b7280",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div>No measures or facts extracted from this transcript.</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Try a different transcript or check your analysis specs.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
                borderRadius: 12,
                border: "2px dashed #e5e7eb",
                padding: 40,
              }}
            >
              <div style={{ textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Analysis Results</div>
                <div style={{ fontSize: 14 }}>Run an analysis to see results here</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Types
type CallerProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
};

type PersonalityProfile = {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  confidenceScore: number | null;
  lastAggregatedAt: string | null;
  observationsUsed: number;
  preferredTone: string | null;
  preferredLength: string | null;
  technicalLevel: string | null;
};

type PersonalityObservation = {
  id: string;
  callId: string;
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  confidence: number | null;
  observedAt: string;
};

type Memory = {
  id: string;
  category: string;
  key: string;
  value: string;
  evidence: string | null;
  confidence: number;
  extractedAt: string;
  expiresAt: string | null;
};

type MemorySummary = {
  factCount: number;
  preferenceCount: number;
  eventCount: number;
  topicCount: number;
  keyFacts: { key: string; value: string; confidence: number }[];
  preferences: Record<string, string>;
  topTopics: { topic: string }[];
};

type Call = {
  id: string;
  source: string;
  externalId: string | null;
  transcript: string;
  createdAt: string;
};

type CallerData = {
  caller: CallerProfile;
  personality: PersonalityProfile | null;
  observations: PersonalityObservation[];
  memories: Memory[];
  memorySummary: MemorySummary | null;
  calls: Call[];
  counts: {
    calls: number;
    memories: number;
    observations: number;
  };
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  FACT: { bg: "#dbeafe", text: "#2563eb" },
  PREFERENCE: { bg: "#fef3c7", text: "#d97706" },
  EVENT: { bg: "#dcfce7", text: "#16a34a" },
  TOPIC: { bg: "#f3e8ff", text: "#9333ea" },
  RELATIONSHIP: { bg: "#fce7f3", text: "#db2777" },
  CONTEXT: { bg: "#e5e7eb", text: "#4b5563" },
};

const TRAIT_INFO = {
  openness: { label: "Openness", color: "#3b82f6", desc: "Curiosity, creativity, openness to new experiences" },
  conscientiousness: { label: "Conscientiousness", color: "#10b981", desc: "Organization, dependability, self-discipline" },
  extraversion: { label: "Extraversion", color: "#f59e0b", desc: "Sociability, assertiveness, positive emotions" },
  agreeableness: { label: "Agreeableness", color: "#ec4899", desc: "Cooperation, trust, helpfulness" },
  neuroticism: { label: "Neuroticism", color: "#8b5cf6", desc: "Emotional instability, anxiety, moodiness" },
};

type SectionId = "overview" | "calls" | "memories" | "personality" | "goals";

export default function CallerDetailPage() {
  const params = useParams();
  const callerId = params.callerId as string;

  const [data, setData] = useState<CallerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  // Expanded states
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  useEffect(() => {
    if (!callerId) return;

    fetch(`/api/callers/${callerId}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setData(result);
        } else {
          setError(result.error || "Failed to load caller");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [callerId]);

  const getCallerLabel = (caller: CallerProfile | undefined) => {
    if (!caller) return "Unknown";
    return caller.name || caller.email || caller.phone || caller.externalId || "Unknown";
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading caller profile...</div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error || "Caller not found"}
        </div>
        <Link href="/callers" style={{ display: "inline-block", marginTop: 16, color: "#4f46e5" }}>
          ← Back to Callers
        </Link>
      </div>
    );
  }

  const sections: { id: SectionId; label: string; icon: string; count?: number }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "calls", label: "Calls", icon: "📞", count: data.counts.calls },
    { id: "memories", label: "Memories", icon: "💭", count: data.counts.memories },
    { id: "personality", label: "Personality", icon: "🧠", count: data.counts.observations },
    { id: "goals", label: "Goals", icon: "🎯" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/callers" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>
          ← Back to Callers
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            👤
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{getCallerLabel(data.caller)}</h1>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {data.caller.email && (
                <span style={{ fontSize: 13, color: "#6b7280" }}>{data.caller.email}</span>
              )}
              {data.caller.phone && (
                <span style={{ fontSize: 13, color: "#6b7280" }}>{data.caller.phone}</span>
              )}
              {data.caller.externalId && (
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>
                  ID: {data.caller.externalId}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 0 }}>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeSection === section.id ? 600 : 400,
              color: activeSection === section.id ? "#4f46e5" : "#6b7280",
              cursor: "pointer",
              borderBottom: activeSection === section.id ? "2px solid #4f46e5" : "2px solid transparent",
              marginBottom: -1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{section.icon}</span>
            {section.label}
            {section.count !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  background: activeSection === section.id ? "#e0e7ff" : "#f3f4f6",
                  color: activeSection === section.id ? "#4f46e5" : "#6b7280",
                  padding: "2px 6px",
                  borderRadius: 10,
                }}
              >
                {section.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === "overview" && (
        <OverviewSection data={data} onNavigate={setActiveSection} />
      )}

      {activeSection === "calls" && (
        <CallsSection
          calls={data.calls}
          expandedCall={expandedCall}
          setExpandedCall={setExpandedCall}
        />
      )}

      {activeSection === "memories" && (
        <MemoriesSection
          memories={data.memories}
          summary={data.memorySummary}
          expandedMemory={expandedMemory}
          setExpandedMemory={setExpandedMemory}
        />
      )}

      {activeSection === "personality" && (
        <PersonalitySection
          personality={data.personality}
          observations={data.observations}
        />
      )}

      {activeSection === "goals" && <GoalsSection callerId={callerId} />}
    </div>
  );
}

// Overview Section
function OverviewSection({
  data,
  onNavigate,
}: {
  data: CallerData;
  onNavigate: (section: SectionId) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
      {/* Quick Stats */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Quick Stats</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard label="Total Calls" value={data.counts.calls} icon="📞" onClick={() => onNavigate("calls")} />
          <StatCard label="Memories" value={data.counts.memories} icon="💭" onClick={() => onNavigate("memories")} />
          <StatCard label="Observations" value={data.counts.observations} icon="👁️" onClick={() => onNavigate("personality")} />
          <StatCard
            label="Confidence"
            value={data.personality?.confidenceScore ? `${(data.personality.confidenceScore * 100).toFixed(0)}%` : "—"}
            icon="📊"
          />
        </div>
      </div>

      {/* Personality Summary */}
      {data.personality && (
        <div
          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("personality")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Personality Profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(TRAIT_INFO).map(([key, info]) => {
              const value = data.personality?.[key as keyof typeof TRAIT_INFO] as number | null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#6b7280", width: 100 }}>{info.label}</span>
                  <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(value || 0) * 100}%`,
                        background: info.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#374151", width: 40, textAlign: "right" }}>
                    {value !== null ? (value * 100).toFixed(0) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Facts */}
      {data.memorySummary && data.memorySummary.keyFacts.length > 0 && (
        <div
          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("memories")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Key Facts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.memorySummary.keyFacts.slice(0, 5).map((fact, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#6b7280" }}>{fact.key}</span>
                <span style={{ fontWeight: 500 }}>{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preferences */}
      {data.memorySummary && Object.keys(data.memorySummary.preferences).length > 0 && (
        <div
          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("memories")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Preferences</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(data.memorySummary.preferences).slice(0, 6).map(([key, value]) => (
              <span
                key={key}
                style={{
                  padding: "4px 10px",
                  background: CATEGORY_COLORS.PREFERENCE.bg,
                  color: CATEGORY_COLORS.PREFERENCE.text,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Calls */}
      <div
        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, cursor: "pointer" }}
        onClick={() => onNavigate("calls")}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Recent Calls</h3>
        {data.calls.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>No calls yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.calls.slice(0, 3).map((call) => (
              <div key={call.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#374151" }}>{call.source}</span>
                <span style={{ color: "#9ca3af" }}>{new Date(call.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: "#f9fafb",
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "#1f2937" }}>{value}</div>
    </div>
  );
}

// Calls Section
function CallsSection({
  calls,
  expandedCall,
  setExpandedCall,
}: {
  calls: Call[];
  expandedCall: string | null;
  setExpandedCall: (id: string | null) => void;
}) {
  if (calls.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No calls yet</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {calls.map((call) => {
        const isExpanded = expandedCall === call.id;
        return (
          <div key={call.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => setExpandedCall(isExpanded ? null : call.id)}
              style={{
                width: "100%",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isExpanded ? "#f9fafb" : "#fff",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14 }}>📞</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{call.source}</span>
                {call.externalId && (
                  <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{call.externalId}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{new Date(call.createdAt).toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{isExpanded ? "▼" : "▶"}</span>
              </div>
            </button>
            {isExpanded && (
              <div style={{ padding: 16, borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Transcript</div>
                <pre
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    fontFamily: "ui-monospace, monospace",
                    color: "#374151",
                    maxHeight: 400,
                    overflow: "auto",
                    background: "#fff",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {call.transcript}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Memories Section
function MemoriesSection({
  memories,
  summary,
  expandedMemory,
  setExpandedMemory,
}: {
  memories: Memory[];
  summary: MemorySummary | null;
  expandedMemory: string | null;
  setExpandedMemory: (id: string | null) => void;
}) {
  return (
    <div>
      {/* Summary Cards */}
      {summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Facts", count: summary.factCount, color: CATEGORY_COLORS.FACT },
            { label: "Preferences", count: summary.preferenceCount, color: CATEGORY_COLORS.PREFERENCE },
            { label: "Events", count: summary.eventCount, color: CATEGORY_COLORS.EVENT },
            { label: "Topics", count: summary.topicCount, color: CATEGORY_COLORS.TOPIC },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "10px 16px",
                background: stat.color.bg,
                borderRadius: 8,
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, color: stat.color.text }}>{stat.count}</div>
              <div style={{ fontSize: 11, color: stat.color.text }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Memories List */}
      {memories.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No memories extracted yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Run the Memory Extractor agent</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map((memory) => {
            const isExpanded = expandedMemory === memory.id;
            const categoryStyle = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.FACT;
            return (
              <div key={memory.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isExpanded ? "#f9fafb" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        background: categoryStyle.bg,
                        color: categoryStyle.text,
                        borderRadius: 4,
                      }}
                    >
                      {memory.category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{memory.key}</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>= "{memory.value}"</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{(memory.confidence * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </button>
                {isExpanded && memory.evidence && (
                  <div style={{ padding: 16, borderTop: "1px solid #e5e7eb", background: "#fafafa", fontSize: 13 }}>
                    <div style={{ fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Evidence:</div>
                    <div style={{ fontStyle: "italic", color: "#4b5563" }}>"{memory.evidence}"</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                      Extracted {new Date(memory.extractedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Personality Section
function PersonalitySection({
  personality,
  observations,
}: {
  personality: PersonalityProfile | null;
  observations: PersonalityObservation[];
}) {
  if (!personality && observations.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No personality data yet</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Run the Personality Analyzer agent</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Aggregated Profile */}
      {personality && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
            Aggregated Profile
            {personality.confidenceScore !== null && (
              <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
                ({(personality.confidenceScore * 100).toFixed(0)}% confidence)
              </span>
            )}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(TRAIT_INFO).map(([key, info]) => {
              const value = personality[key as keyof typeof TRAIT_INFO] as number | null;
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{info.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{value !== null ? (value * 100).toFixed(0) : "—"}</span>
                  </div>
                  <div style={{ height: 10, background: "#e5e7eb", borderRadius: 5, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(value || 0) * 100}%`,
                        background: info.color,
                        borderRadius: 5,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{info.desc}</div>
                </div>
              );
            })}
          </div>
          {personality.lastAggregatedAt && (
            <div style={{ marginTop: 16, fontSize: 11, color: "#9ca3af" }}>
              Last updated: {new Date(personality.lastAggregatedAt).toLocaleString()} ({personality.observationsUsed} observations)
            </div>
          )}
        </div>
      )}

      {/* Communication Preferences */}
      {personality && (personality.preferredTone || personality.preferredLength || personality.technicalLevel) && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Communication Preferences</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {personality.preferredTone && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Preferred Tone</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.preferredTone}</span>
              </div>
            )}
            {personality.preferredLength && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Response Length</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.preferredLength}</span>
              </div>
            )}
            {personality.technicalLevel && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Technical Level</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.technicalLevel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Observations Timeline */}
      {observations.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
            Observation History ({observations.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {observations.slice(0, 10).map((obs) => (
              <div key={obs.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", width: 140 }}>{new Date(obs.observedAt).toLocaleString()}</span>
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  {Object.entries(TRAIT_INFO).map(([key, info]) => {
                    const value = obs[key as keyof typeof TRAIT_INFO] as number | null;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{info.label.charAt(0)}</span>
                        <div style={{ width: 40, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(value || 0) * 100}%`,
                              background: info.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>
                  {obs.confidence !== null ? `${(obs.confidence * 100).toFixed(0)}% conf` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Goals Section (placeholder for future)
function GoalsSection({ callerId }: { callerId: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Goals Coming Soon</div>
      <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4, maxWidth: 400, margin: "8px auto" }}>
        Track caller goals, outcomes, and follow-up items extracted from conversations
      </div>
    </div>
  );
}

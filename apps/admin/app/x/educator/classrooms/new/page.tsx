"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";

interface Domain {
  id: string;
  name: string;
  slug: string;
}

interface PlaybookOption {
  id: string;
  name: string;
  description: string | null;
}

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

export default function NewClassroomPage() {
  const router = useRouter();
  const { terms, plural, lower, lowerPlural } = useTerminology();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    joinToken: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Course picker state
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<Set<string>>(new Set());
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);

  useEffect(() => {
    fetchApi("/api/domains")
      .then((res: { ok: boolean; domains?: Domain[] }) => {
        if (res?.ok && res.domains) {
          setDomains(res.domains);
          if (res.domains.length === 1) {
            setDomainId(res.domains[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load playbooks when domain changes
  useEffect(() => {
    if (!domainId) {
      setPlaybooks([]);
      setSelectedPlaybooks(new Set());
      return;
    }
    setLoadingPlaybooks(true);
    fetchApi(`/api/educator/playbooks?domainId=${domainId}`)
      .then((res: { ok: boolean; playbooks?: PlaybookOption[] }) => {
        if (res?.ok && res.playbooks) {
          setPlaybooks(res.playbooks);
          // Pre-select all
          setSelectedPlaybooks(new Set(res.playbooks.map((p) => p.id)));
        }
      })
      .finally(() => setLoadingPlaybooks(false));
  }, [domainId]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");

    const res = await fetchApi("/api/educator/classrooms", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        domainId,
        playbookIds: [...selectedPlaybooks],
      }),
    });

    if (res?.ok) {
      setCreated({
        id: res.classroom.id,
        joinToken: res.classroom.joinToken,
      });
      setStep(4);
    } else {
      setError(res?.error ?? `Failed to create ${lower("cohort")}`);
    }

    setCreating(false);
  };

  const joinUrl = created?.joinToken
    ? `${window.location.origin}/join/${created.joinToken}`
    : "";

  const selectedDomain = domains.find((d) => d.id === domainId);

  const inviteMessage = `You're invited to join ${name}${selectedDomain ? ` (${selectedDomain.name})` : ""}!\n\nJoin here: ${joinUrl}`;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        Create {terms.cohort}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
        Set up a new {lower("cohort")} for your {lowerPlural("learner")}.
      </p>

      {/* Step indicators */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 32,
        }}
      >
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                s <= step
                  ? "var(--button-primary-bg)"
                  : "var(--border-default)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Step 1: Name & Focus */}
      {step === 1 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 20,
            }}
          >
            Name & Learning Focus
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              {terms.cohort} Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Year 10 English, Tuesday Coaching Group"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`A short note about this ${lower("cohort")}...`}
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Learning Focus *
            </label>
            {domains.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No domains available. Please ask an admin to create one.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {domains.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDomainId(d.id)}
                    style={{
                      padding: "8px 16px",
                      border: `2px solid ${domainId === d.id ? "var(--button-primary-bg)" : "var(--border-default)"}`,
                      borderRadius: 8,
                      background:
                        domainId === d.id
                          ? "color-mix(in srgb, var(--button-primary-bg) 10%, transparent)"
                          : "var(--surface-secondary)",
                      color:
                        domainId === d.id
                          ? "var(--button-primary-bg)"
                          : "var(--text-secondary)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            disabled={!name.trim() || !domainId}
            onClick={() => setStep(2)}
            style={{
              width: "100%",
              padding: "10px 20px",
              background: !name.trim() || !domainId ? "var(--border-default)" : "var(--button-primary-bg)",
              color: !name.trim() || !domainId ? "var(--text-muted)" : "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: !name.trim() || !domainId ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Courses */}
      {step === 2 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Courses
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 20,
            }}
          >
            Select which courses to include in this {lower("cohort")}. All are selected by default.
          </p>

          {loadingPlaybooks ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
              Loading courses...
            </div>
          ) : playbooks.length === 0 ? (
            <div
              style={{
                padding: 16,
                background: "var(--surface-secondary)",
                borderRadius: 8,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              No published courses for this domain. Your {lowerPlural("learner")} can still join — courses can be added later.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {playbooks.map((pb) => (
                <button
                  key={pb.id}
                  onClick={() => {
                    setSelectedPlaybooks((prev) => {
                      const next = new Set(prev);
                      if (next.has(pb.id)) next.delete(pb.id);
                      else next.add(pb.id);
                      return next;
                    });
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 12,
                    border: `1px solid ${
                      selectedPlaybooks.has(pb.id)
                        ? "var(--accent-primary)"
                        : "var(--border-default)"
                    }`,
                    borderRadius: 8,
                    background: selectedPlaybooks.has(pb.id)
                      ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)"
                      : "var(--surface-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: `2px solid ${
                        selectedPlaybooks.has(pb.id)
                          ? "var(--accent-primary)"
                          : "var(--border-default)"
                      }`,
                      background: selectedPlaybooks.has(pb.id)
                        ? "var(--accent-primary)"
                        : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {selectedPlaybooks.has(pb.id) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {pb.name}
                    </div>
                    {pb.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {pb.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                flex: 2,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 20,
            }}
          >
            Review
          </h2>

          <div
            style={{
              padding: 16,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {name}
            </div>
            {description && (
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
                {description}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  padding: "4px 10px",
                  background: "var(--surface-primary)",
                  borderRadius: 6,
                  display: "inline-block",
                }}
              >
                {selectedDomain?.name}
              </div>
              {selectedPlaybooks.size > 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    padding: "4px 10px",
                    background: "var(--surface-primary)",
                    borderRadius: 6,
                    display: "inline-block",
                  }}
                >
                  {selectedPlaybooks.size} course{selectedPlaybooks.size !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                background: "color-mix(in srgb, var(--status-error-text) 10%, transparent)",
                color: "var(--status-error-text)",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              disabled={creating}
              onClick={handleCreate}
              style={{
                flex: 2,
                padding: "10px 20px",
                background: creating ? "var(--border-default)" : "var(--button-primary-bg)",
                color: creating ? "var(--text-muted)" : "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating..." : `Create ${terms.cohort}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Invite */}
      {step === 4 && created && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#127881;</div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {terms.cohort} Created!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Invite your {lowerPlural("learner")} to join.
            </p>
          </div>

          {/* Join Link */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Join Link
            </label>
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--surface-secondary)",
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                readOnly
                value={joinUrl}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={copyLink}
                style={{
                  padding: "6px 14px",
                  background: copiedLink ? "#10b981" : "var(--button-primary-bg)",
                  color: "var(--button-primary-text)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}
              >
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Invite Message */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Invite Message
            </label>
            <div
              style={{
                padding: 12,
                background: "var(--surface-secondary)",
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <pre
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  fontFamily: "inherit",
                }}
              >
                {inviteMessage}
              </pre>
            </div>
            <button
              onClick={copyMessage}
              style={{
                padding: "6px 14px",
                background: copiedMessage ? "#10b981" : "var(--surface-secondary)",
                color: copiedMessage ? "white" : "var(--text-secondary)",
                border: copiedMessage ? "none" : "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copiedMessage ? "Copied!" : "Copy Message"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => router.push(`/x/educator/classrooms/${created.id}`)}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go to {terms.cohort}
            </button>
            <button
              onClick={() => {
                setName("");
                setDescription("");
                setDomainId(domains.length === 1 ? domains[0].id : "");
                setCreated(null);
                setSelectedPlaybooks(new Set());
                setStep(1);
              }}
              style={{
                padding: "10px 20px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

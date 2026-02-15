"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Domain {
  id: string;
  name: string;
  slug: string;
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

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const handleCreate = async () => {
    setCreating(true);
    setError("");

    const res = await fetchApi("/api/educator/classrooms", {
      method: "POST",
      body: JSON.stringify({ name, description, domainId }),
    });

    if (res?.ok) {
      setCreated({
        id: res.classroom.id,
        joinToken: res.classroom.joinToken,
      });
      setStep(3);
    } else {
      setError(res?.error ?? "Failed to create classroom");
    }

    setCreating(false);
  };

  const joinUrl = created?.joinToken
    ? `${window.location.origin}/join/${created.joinToken}`
    : "";

  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        Create Classroom
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
        Set up a learning group for your students.
      </p>

      {/* Step indicators */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 32,
        }}
      >
        {[1, 2, 3].map((s) => (
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
              Classroom Name *
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
              placeholder="A short note about this classroom..."
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

      {/* Step 2: Review */}
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
              {domains.find((d) => d.id === domainId)?.name}
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
              {creating ? "Creating..." : "Create Classroom"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Invite */}
      {step === 3 && created && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Classroom Created!
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginBottom: 24,
            }}
          >
            Share this link with your students to join:
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 24,
              padding: "12px 16px",
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
                fontSize: 14,
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <button
              onClick={copyLink}
              style={{
                padding: "6px 16px",
                background: copied ? "#10b981" : "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.2s",
              }}
            >
              {copied ? "Copied!" : "Copy Link"}
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
              Go to Classroom
            </button>
            <button
              onClick={() => {
                setName("");
                setDescription("");
                setDomainId(domains.length === 1 ? domains[0].id : "");
                setCreated(null);
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

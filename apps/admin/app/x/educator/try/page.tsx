"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

interface Classroom {
  id: string;
  name: string;
  domain: { id: string; name: string; slug: string };
}

export default function TryItPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading...</div></div>}>
      <TryItContent />
    </Suspense>
  );
}

function TryItContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const institutionId = searchParams.get("institutionId");
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const instQuery = institutionId ? `?institutionId=${institutionId}` : "";
    fetchApi(`/api/educator/classrooms${instQuery}`)
      .then((res: { ok: boolean; classrooms: Classroom[] }) => {
        if (res?.ok) {
          setClassrooms(res.classrooms);
          if (res.classrooms.length === 1) {
            setSelected(res.classrooms[0].domain.id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [institutionId]);

  const handleStart = async () => {
    setStarting(true);

    // Check if educator already has a sim caller
    const setupInfo = await fetchApi("/api/sim/setup-info");

    if (setupInfo?.caller) {
      // Already has a caller — go directly to sim
      router.push(`/x/sim/${setupInfo.caller.id}`);
      return;
    }

    // Create a caller via sim setup
    const res = await fetchApi("/api/sim/setup", {
      method: "POST",
      body: JSON.stringify({ domainId: selected }),
    });

    if (res?.ok && res.caller) {
      router.push(`/x/sim/${res.caller.id}`);
    } else {
      // Fallback: go to sim setup page
      router.push("/x/sim/setup");
    }
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
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎧</div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Try It
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            maxWidth: 400,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Experience the learning call exactly as your students will. Same AI
          tutor, same domain, same conversation flow.
        </p>
      </div>

      {classrooms.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Create a classroom first to try the learning experience.
          </p>
          <button
            onClick={() => router.push("/x/educator/classrooms/new")}
            style={{
              padding: "10px 24px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create Classroom
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          {classrooms.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                Choose a learning focus
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {classrooms.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.domain.id)}
                    style={{
                      padding: "8px 16px",
                      border: `2px solid ${selected === c.domain.id ? "var(--button-primary-bg)" : "var(--border-default)"}`,
                      borderRadius: 8,
                      background:
                        selected === c.domain.id
                          ? "color-mix(in srgb, var(--button-primary-bg) 10%, transparent)"
                          : "var(--surface-secondary)",
                      color:
                        selected === c.domain.id
                          ? "var(--button-primary-bg)"
                          : "var(--text-secondary)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {c.name} — {c.domain.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              padding: 16,
              background: "color-mix(in srgb, #8b5cf6 8%, transparent)",
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            You&apos;ll have a conversation with the same AI tutor your students
            interact with. This is a great way to understand the experience and
            spot areas for improvement.
          </div>

          <button
            disabled={!selected || starting}
            onClick={handleStart}
            style={{
              width: "100%",
              padding: "12px 20px",
              background:
                !selected || starting
                  ? "var(--border-default)"
                  : "var(--button-primary-bg)",
              color:
                !selected || starting
                  ? "var(--text-muted)"
                  : "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: !selected || starting ? "not-allowed" : "pointer",
            }}
          >
            {starting ? "Starting..." : "Start Call"}
          </button>
        </div>
      )}
    </div>
  );
}

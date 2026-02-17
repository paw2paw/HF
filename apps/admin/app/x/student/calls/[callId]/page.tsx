"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface CallDetail {
  id: string;
  createdAt: string;
  endedAt: string | null;
  transcript: string;
}

export default function StudentCallDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;
    fetch(`/api/student/calls/${callId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCall(d.call);
        } else {
          setError(d.error || "Call not found");
        }
      })
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-24 rounded bg-[var(--surface-secondary)]" />
          <div className="h-64 rounded-lg bg-[var(--surface-secondary)]" />
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="p-6">
        <Link
          href="/x/student/calls"
          className="inline-flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-80"
          style={{ color: "var(--accent-primary)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back to calls
        </Link>
        <p style={{ color: "var(--text-muted)" }}>{error || "Call not found"}</p>
      </div>
    );
  }

  const date = new Date(call.createdAt);
  const duration = call.endedAt
    ? Math.round((new Date(call.endedAt).getTime() - date.getTime()) / 60000)
    : null;

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/x/student/calls"
        className="inline-flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-80"
        style={{ color: "var(--accent-primary)", textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Back to calls
      </Link>

      <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        Call on {date.toLocaleDateString()}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {duration !== null ? ` \u2022 ${duration} min` : ""}
      </p>

      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--surface-primary)",
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Transcript
        </h2>
        <div
          className="text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          {call.transcript || "No transcript available."}
        </div>
      </div>
    </div>
  );
}

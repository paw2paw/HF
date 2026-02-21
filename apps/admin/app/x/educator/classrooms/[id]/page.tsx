"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SendArtifactModal } from "@/components/educator/SendArtifactModal";
import { useTerminology } from "@/contexts/TerminologyContext";

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

interface Member {
  id: string;
  name: string;
  email: string | null;
  totalCalls: number;
  lastCallAt: string | null;
  joinedAt: string;
}

interface ClassroomDetail {
  id: string;
  name: string;
  description: string | null;
  domain: { id: string; name: string; slug: string };
  memberCount: number;
  isActive: boolean;
  joinToken: string | null;
  createdAt: string;
}

type Tab = "roster" | "settings";

export default function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { terms, plural, lower, lowerPlural } = useTerminology();

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("roster");

  // Editing state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Invite state
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Active calls for "In Call" badges
  const [activeCalls, setActiveCalls] = useState<Map<string, string>>(new Map());

  // Send to class modal
  const [showSendModal, setShowSendModal] = useState(false);

  const loadClassroom = useCallback(async () => {
    const [classroomRes, callsRes] = await Promise.all([
      fetchApi(`/api/educator/classrooms/${id}`),
      fetchApi("/api/educator/active-calls"),
    ]);
    if (classroomRes?.ok) {
      setClassroom(classroomRes.classroom);
      setMembers(classroomRes.members);
      setEditName(classroomRes.classroom.name);
      setEditDesc(classroomRes.classroom.description ?? "");
    }
    if (callsRes?.ok) {
      const map = new Map<string, string>();
      for (const c of callsRes.activeCalls) {
        if (c.callerId) map.set(c.callerId, c.callId);
      }
      setActiveCalls(map);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadClassroom();
  }, [loadClassroom]);

  const [copied, setCopied] = useState(false);
  const joinUrl = classroom?.joinToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${classroom.joinToken}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetchApi(`/api/educator/classrooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (res?.ok) {
      setClassroom((prev) => prev ? { ...prev, name: editName, description: editDesc || null } : prev);
    }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!confirm(`Archive this ${lower("cohort")}? ${plural("caller")} will no longer be tracked.`)) return;
    const res = await fetchApi(`/api/educator/classrooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
    if (res?.ok) router.push("/x/educator/classrooms");
  };

  const handleInvite = async () => {
    const emails = inviteEmails
      .split(/[,\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) return;

    setInviting(true);
    setInviteResult(null);

    const res = await fetchApi(`/api/educator/classrooms/${id}/invite`, {
      method: "POST",
      body: JSON.stringify({ emails }),
    });

    if (res?.ok) {
      setInviteResult(`${res.created} invite${res.created !== 1 ? "s" : ""} sent`);
      setInviteEmails("");
    } else {
      setInviteResult(res?.error ?? "Failed to send invites");
    }

    setInviting(false);
  };

  const handleRemoveMember = async (callerId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this classroom?`)) return;
    const res = await fetchApi(`/api/educator/classrooms/${id}/members/${callerId}`, {
      method: "DELETE",
    });
    if (res?.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== callerId));
      setClassroom((prev) => prev ? { ...prev, memberCount: prev.memberCount - 1 } : prev);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading {lower("cohort")}...</div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>{terms.cohort} not found.</div>
      </div>
    );
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/x/educator/classrooms"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          &larr; {plural("cohort")}
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <h1 className="hf-page-title" style={{ marginBottom: 4 }}>
              {classroom.name}
            </h1>
            <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
              <span>{classroom.memberCount} {classroom.memberCount !== 1 ? lowerPlural("caller") : lower("caller")}</span>
              <span
                style={{
                  padding: "1px 8px",
                  background: "var(--surface-secondary)",
                  borderRadius: 4,
                }}
              >
                {classroom.domain.name}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="hf-btn hf-btn-primary flex-shrink-0"
            style={{ fontSize: 13 }}
          >
            Send to Class
          </button>
        </div>
      </div>

      {/* Join Link Banner */}
      {classroom.joinToken && (
        <div
          className="hf-banner hf-banner-info flex items-center gap-3"
          style={{ marginBottom: 20 }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
            Invite link: <span style={{ fontFamily: "monospace", fontSize: 12 }}>{joinUrl}</span>
          </span>
          <button
            onClick={copyLink}
            className="hf-btn hf-btn-primary"
            style={{
              padding: "4px 12px", fontSize: 12,
              background: copied ? "var(--status-success-text)" : undefined,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1" style={{ marginBottom: 20, borderBottom: "1px solid var(--border-default)" }}>
        {(["roster", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`hf-tab${tab === t ? " hf-tab-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Roster Tab */}
      {tab === "roster" && (
        <div>
          {/* Invite section */}
          <div className="hf-card-compact" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Invite {plural("caller")}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="Enter email addresses (comma-separated)"
                className="hf-input"
                style={{ flex: 1, fontSize: 13 }}
              />
              <button
                disabled={inviting || !inviteEmails.trim()}
                onClick={handleInvite}
                className="hf-btn hf-btn-primary"
                style={{ fontSize: 13 }}
              >
                {inviting ? "Sending..." : "Send Invites"}
              </button>
            </div>
            {inviteResult && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {inviteResult}
              </div>
            )}
          </div>

          {/* Student List */}
          {members.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              No {lowerPlural("caller")} yet. Share the invite link or send email invites above.
            </div>
          ) : (
            <div className="hf-card-compact" style={{ overflow: "hidden", padding: 0 }}>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border-default)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Name</th>
                    <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600 }}>Calls</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Last Call</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const lastCall = m.lastCallAt ? new Date(m.lastCallAt).getTime() : 0;
                    const isActive = lastCall > sevenDaysAgo;
                    const neverCalled = !m.lastCallAt;
                    const statusColor = neverCalled ? "var(--text-muted)" : isActive ? "var(--status-success-text)" : "var(--status-warning-text)";
                    const statusLabel = neverCalled ? "Not started" : isActive ? "Active" : "Inactive";

                    return (
                      <tr
                        key={m.id}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <Link
                            href={`/x/educator/students/${m.id}`}
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              textDecoration: "none",
                            }}
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
                          {m.totalCalls}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-muted)" }}>
                          {m.lastCallAt
                            ? new Date(m.lastCallAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {activeCalls.has(m.id) ? (
                            <Link
                              href={`/x/educator/observe/${activeCalls.get(m.id)}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--status-success-text)",
                                textDecoration: "none",
                                padding: "2px 8px",
                                background: "var(--status-success-bg)",
                                borderRadius: 6,
                                border: "1px solid var(--status-success-border)",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-success-text)" }} />
                              In Call
                            </Link>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                color: statusColor,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: statusColor,
                                }}
                              />
                              {statusLabel}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            style={{
                              background: "none",
                              border: "none",
                              fontSize: 12,
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              padding: "4px 8px",
                              borderRadius: 4,
                            }}
                            title={`Remove ${lower("caller")}`}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="hf-card">
          <div style={{ marginBottom: 16 }}>
            <label className="hf-label">{terms.cohort} Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="hf-input"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="hf-label">Description</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="hf-input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
          <div className="flex gap-3">
            <button
              disabled={saving}
              onClick={handleSave}
              className="hf-btn hf-btn-primary"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleArchive}
              className="hf-btn hf-btn-destructive"
            >
              Archive {terms.cohort}
            </button>
          </div>
        </div>
      )}

      {showSendModal && classroom && (
        <SendArtifactModal
          target={{ type: "classroom", id, name: classroom.name }}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => setShowSendModal(false)}
        />
      )}
    </div>
  );
}

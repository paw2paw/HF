"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SendArtifactModal } from "@/components/educator/SendArtifactModal";

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
    if (!confirm("Archive this classroom? Students will no longer be tracked.")) return;
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
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading classroom...</div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Classroom not found.</div>
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
          &larr; Classrooms
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {classroom.name}
            </h1>
            <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
              <span>{classroom.memberCount} student{classroom.memberCount !== 1 ? "s" : ""}</span>
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
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-primary)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Send to Class
          </button>
        </div>
      </div>

      {/* Join Link Banner */}
      {classroom.joinToken && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "color-mix(in srgb, #3b82f6 8%, transparent)",
            border: "1px solid color-mix(in srgb, #3b82f6 20%, transparent)",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
            Invite link: <span style={{ fontFamily: "monospace", fontSize: 12 }}>{joinUrl}</span>
          </span>
          <button
            onClick={copyLink}
            style={{
              padding: "4px 12px",
              background: copied ? "#10b981" : "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {(["roster", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              color: tab === t ? "var(--button-primary-bg)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid var(--button-primary-bg)" : "2px solid transparent",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Roster Tab */}
      {tab === "roster" && (
        <div>
          {/* Invite section */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Invite Students
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="Enter email addresses (comma-separated)"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                disabled={inviting || !inviteEmails.trim()}
                onClick={handleInvite}
                style={{
                  padding: "8px 16px",
                  background: inviting || !inviteEmails.trim() ? "var(--border-default)" : "var(--button-primary-bg)",
                  color: inviting || !inviteEmails.trim() ? "var(--text-muted)" : "var(--button-primary-text)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: inviting || !inviteEmails.trim() ? "not-allowed" : "pointer",
                }}
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
              No students yet. Share the invite link or send email invites above.
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
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
                    const statusColor = neverCalled ? "#6b7280" : isActive ? "#10b981" : "#f59e0b";
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
                                color: "#059669",
                                textDecoration: "none",
                                padding: "2px 8px",
                                background: "#ecfdf5",
                                borderRadius: 6,
                                border: "1px solid #a7f3d0",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
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
                            title="Remove student"
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
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
            >
              Classroom Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
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
          <div style={{ marginBottom: 20 }}>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
            >
              Description
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
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
          <div style={{ display: "flex", gap: 12 }}>
            <button
              disabled={saving}
              onClick={handleSave}
              style={{
                padding: "8px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleArchive}
              style={{
                padding: "8px 20px",
                background: "transparent",
                color: "var(--status-error-text)",
                border: "1px solid var(--status-error-text)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Archive Classroom
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

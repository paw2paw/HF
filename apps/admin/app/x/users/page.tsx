"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";

interface User {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  domainId: string | null;
  domain: { id: string; name: string; slug: string } | null;
  sentAt: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface Domain {
  id: string;
  name: string;
  slug: string;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; darkBg: string; darkText: string }> = {
  ADMIN: { bg: "#f3e8ff", text: "#7c3aed", darkBg: "#4c1d95", darkText: "#c4b5fd" },
  OPERATOR: { bg: "#dbeafe", text: "#2563eb", darkBg: "#1e3a5f", darkText: "#93c5fd" },
  VIEWER: { bg: "#f3f4f6", text: "#4b5563", darkBg: "#374151", darkText: "#d1d5db" },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
];

function getAvatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteFirstName, setNewInviteFirstName] = useState("");
  const [newInviteLastName, setNewInviteLastName] = useState("");
  const [newInviteRole, setNewInviteRole] = useState<UserRole>("OPERATOR");
  const [newInviteDomainId, setNewInviteDomainId] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Audit logging state
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, invitesRes, auditRes, domainsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/invites"),
        fetch("/api/admin/audit"),
        fetch("/api/domains"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites);
      }

      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditEnabled(data.enabled);
        setAuditLogs(data.logs || []);
      }

      if (domainsRes.ok) {
        const data = await domainsRes.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !auditEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditEnabled(data.enabled);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to toggle audit:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setLastInviteUrl(null);

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newInviteEmail,
          role: newInviteRole,
          firstName: newInviteFirstName || undefined,
          lastName: newInviteLastName || undefined,
          domainId: newInviteDomainId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to create invite");
        return;
      }

      const emailStatus = data.emailSent ? "Email sent" : "Email failed — share link manually";
      setInviteSuccess(`Invite created for ${newInviteEmail}. ${emailStatus}.`);
      setLastInviteUrl(data.inviteUrl || null);
      setNewInviteEmail("");
      setNewInviteFirstName("");
      setNewInviteLastName("");
      setNewInviteDomainId("");
      fetchData();
    } catch {
      setInviteError("Failed to create invite");
    }
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      await fetch(`/api/invites?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete invite:", err);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  };

  const handleChangeRole = async (user: User, newRole: UserRole) => {
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, role: newRole }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDelete(null);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleUpdateProfile = async (userId: string, updates: { name?: string; displayName?: string }) => {
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, ...updates }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "3px solid var(--border-default)",
          borderTopColor: "var(--button-primary-bg)",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);
  const pendingInvites = invites.filter((i) => !i.usedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Team Members
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {activeUsers.length} active user{activeUsers.length !== 1 ? "s" : ""}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{session.user.email}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{session.user.role}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                padding: "6px 12px", fontSize: 13, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "transparent",
                color: "var(--text-primary)", cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Invite New User */}
      <div style={{
        padding: 24, borderRadius: 12,
        background: "var(--surface-primary)", border: "1px solid var(--border-default)",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>
          Invite Field Tester
        </h2>
        <form onSubmit={handleCreateInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Row 1: Email + Role */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="email"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              placeholder="tester@example.com"
              required
              style={{
                flex: 1, padding: "8px 14px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            <select
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
              style={{
                padding: "8px 12px", fontSize: 13, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", cursor: "pointer",
              }}
            >
              <option value="OPERATOR">Operator</option>
              <option value="ADMIN">Admin</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>

          {/* Row 2: First/Last Name + Domain */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={newInviteFirstName}
              onChange={(e) => setNewInviteFirstName(e.target.value)}
              placeholder="First name (optional)"
              style={{
                flex: 1, padding: "8px 14px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            <input
              type="text"
              value={newInviteLastName}
              onChange={(e) => setNewInviteLastName(e.target.value)}
              placeholder="Last name (optional)"
              style={{
                flex: 1, padding: "8px 14px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            <select
              value={newInviteDomainId}
              onChange={(e) => setNewInviteDomainId(e.target.value)}
              style={{
                minWidth: 160, padding: "8px 12px", fontSize: 13, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", cursor: "pointer",
              }}
            >
              <option value="">Any domain (chooser)</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              style={{
                padding: "8px 24px", fontSize: 14, fontWeight: 500, borderRadius: 8,
                background: "var(--button-primary-bg)", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              Send Invite
            </button>
          </div>
        </form>

        {inviteError && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{inviteError}</p>}
        {inviteSuccess && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "#22c55e", margin: 0 }}>{inviteSuccess}</p>
            {lastInviteUrl && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 8,
                background: "var(--surface-secondary, var(--surface-primary))",
                border: "1px solid var(--border-default)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <code style={{ flex: 1, fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
                  {lastInviteUrl}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(lastInviteUrl); }}
                  style={{
                    padding: "4px 10px", fontSize: 12, borderRadius: 6,
                    border: "1px solid var(--border-default)", background: "transparent",
                    color: "var(--text-primary)", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div style={{
          padding: 24, borderRadius: 12,
          background: "var(--surface-primary)", border: "1px solid var(--border-default)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>
            Pending Invites
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 8,
                  border: "1px dashed var(--border-default)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--border-default)", fontSize: 14, color: "var(--text-muted)",
                  }}>
                    {invite.firstName ? invite.firstName[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                      {invite.firstName || invite.lastName
                        ? `${invite.firstName || ""} ${invite.lastName || ""}`.trim()
                        : invite.email}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {invite.firstName && <span>{invite.email}</span>}
                      <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: ROLE_COLORS[invite.role].bg, color: ROLE_COLORS[invite.role].text,
                      }}>
                        {invite.role}
                      </span>
                      {invite.domain && (
                        <span style={{
                          padding: "1px 6px", borderRadius: 4, fontSize: 10,
                          background: "var(--border-default)", color: "var(--text-primary)",
                        }}>
                          {invite.domain.name}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: invite.sentAt ? "#22c55e" : "#f59e0b" }}>
                        {invite.sentAt ? "Email sent" : "Not sent"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  style={{
                    padding: "4px 10px", fontSize: 12, borderRadius: 6,
                    background: "transparent", border: "1px solid #ef4444",
                    color: "#ef4444", cursor: "pointer",
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Cards Grid */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>
          Active Users
        </h2>
        {activeUsers.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No users yet. Send some invites!</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {activeUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isCurrentUser={user.id === session?.user?.id}
                isAdmin={isAdmin}
                confirmDelete={confirmDelete}
                onToggleActive={() => handleToggleActive(user)}
                onChangeRole={(role) => handleChangeRole(user, role)}
                onDelete={() => handleDeleteUser(user.id)}
                onConfirmDelete={() => setConfirmDelete(user.id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onUpdateProfile={(updates) => handleUpdateProfile(user.id, updates)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 16px" }}>
            Deactivated ({inactiveUsers.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {inactiveUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isCurrentUser={user.id === session?.user?.id}
                isAdmin={isAdmin}
                confirmDelete={confirmDelete}
                onToggleActive={() => handleToggleActive(user)}
                onChangeRole={(role) => handleChangeRole(user, role)}
                onDelete={() => handleDeleteUser(user.id)}
                onConfirmDelete={() => setConfirmDelete(user.id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onUpdateProfile={(updates) => handleUpdateProfile(user.id, updates)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin Settings */}
      {isAdmin && (
        <div style={{
          padding: 24, borderRadius: 12,
          background: "var(--surface-primary)", border: "1px solid var(--border-default)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>
            Admin Settings
          </h2>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-default)",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Audit Logging</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Track who does what in the system
              </div>
            </div>
            <button
              onClick={handleToggleAudit}
              disabled={auditLoading}
              style={{
                position: "relative", width: 44, height: 24, borderRadius: 12,
                background: auditEnabled ? "#22c55e" : "var(--border-default)",
                border: "none", cursor: auditLoading ? "wait" : "pointer",
                opacity: auditLoading ? 0.5 : 1, transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: auditEnabled ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </button>
          </div>

          {auditEnabled && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowAuditLogs(!showAuditLogs)}
                style={{
                  fontSize: 13, color: "var(--button-primary-bg)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                {showAuditLogs ? "Hide" : "Show"} Recent Activity ({auditLogs.length} logs)
              </button>

              {showAuditLogs && auditLogs.length > 0 && (
                <div style={{
                  marginTop: 12, maxHeight: 256, overflowY: "auto", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                }}>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", background: "var(--surface-secondary, var(--surface-primary))" }}>
                        <th style={{ padding: "8px 12px", fontWeight: 500 }}>Time</th>
                        <th style={{ padding: "8px 12px", fontWeight: 500 }}>User</th>
                        <th style={{ padding: "8px 12px", fontWeight: 500 }}>Action</th>
                        <th style={{ padding: "8px 12px", fontWeight: 500 }}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 50).map((log) => (
                        <tr key={log.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>
                            {log.userEmail || "System"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{
                              padding: "2px 6px", borderRadius: 4, fontSize: 11,
                              background: "var(--border-default)", color: "var(--text-primary)",
                            }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                            {log.entityType && log.entityId
                              ? `${log.entityType}:${log.entityId.slice(0, 8)}...`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showAuditLogs && auditLogs.length === 0 && (
                <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                  No audit logs yet. Actions will appear here once logging is enabled.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── User Card Component ── */
function UserCard({
  user,
  isCurrentUser,
  isAdmin,
  confirmDelete,
  onToggleActive,
  onChangeRole,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onUpdateProfile,
}: {
  user: User;
  isCurrentUser: boolean;
  isAdmin: boolean;
  confirmDelete: string | null;
  onToggleActive: () => void;
  onChangeRole: (role: UserRole) => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onUpdateProfile: (updates: { name?: string; displayName?: string }) => void;
}) {
  const colors = ROLE_COLORS[user.role];
  const isConfirming = confirmDelete === user.id;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editDisplayName, setEditDisplayName] = useState(user.displayName || "");

  return (
    <div
      style={{
        padding: 20, borderRadius: 12, position: "relative",
        background: "var(--surface-primary)",
        border: `1px solid ${user.isActive ? "var(--border-default)" : "#ef444433"}`,
        opacity: user.isActive ? 1 : 0.6,
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "var(--button-primary-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = user.isActive ? "var(--border-default)" : "#ef444433";
      }}
    >
      {/* Top row: avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: getAvatarGradient(user.id),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "#fff",
        }}>
          {(user.displayName || user.name || user.email)[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.displayName || user.name || user.email.split("@")[0]}
            {isCurrentUser && (
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>(you)</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
        </div>
        {isCurrentUser && !editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6,
              border: "1px solid var(--border-default)", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Editable profile fields (current user only) */}
      {isCurrentUser && editing && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          background: "var(--surface-secondary, var(--surface-primary))",
          border: "1px solid var(--border-default)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Full Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="First Last"
              style={{
                width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6,
                border: "1px solid var(--border-default)", background: "var(--surface-primary)",
                color: "var(--text-primary)", outline: "none",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Display Name (what the system calls you)
            </label>
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="e.g. Paul"
              style={{
                width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6,
                border: "1px solid var(--border-default)", background: "var(--surface-primary)",
                color: "var(--text-primary)", outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: "5px 12px", fontSize: 12, borderRadius: 6,
                border: "1px solid var(--border-default)", background: "transparent",
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onUpdateProfile({
                  name: editName || undefined,
                  displayName: editDisplayName || undefined,
                });
                setEditing(false);
              }}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6,
                border: "none", background: "var(--button-primary-bg)",
                color: "#fff", cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Role + meta */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        {isAdmin && !isCurrentUser ? (
          <select
            value={user.role}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
            style={{
              padding: "3px 8px", fontSize: 12, fontWeight: 600, borderRadius: 999,
              background: colors.bg, color: colors.text,
              border: "none", cursor: "pointer", appearance: "auto",
            }}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="OPERATOR">OPERATOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        ) : (
          <span style={{
            padding: "3px 10px", fontSize: 12, fontWeight: 600, borderRadius: 999,
            background: colors.bg, color: colors.text,
          }}>
            {user.role}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Actions */}
      {isAdmin && !isCurrentUser && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border-default)", paddingTop: 12 }}>
          <button
            onClick={onToggleActive}
            style={{
              flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 500, borderRadius: 6,
              border: "1px solid var(--border-default)", background: "transparent",
              color: user.isActive ? "#f59e0b" : "#22c55e", cursor: "pointer",
            }}
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </button>
          {!isConfirming ? (
            <button
              onClick={onConfirmDelete}
              style={{
                padding: "6px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6,
                border: "1px solid #ef444444", background: "transparent",
                color: "#ef4444", cursor: "pointer",
              }}
            >
              Delete
            </button>
          ) : (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={onDelete}
                style={{
                  padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6,
                  border: "none", background: "#ef4444", color: "#fff", cursor: "pointer",
                }}
              >
                Confirm
              </button>
              <button
                onClick={onCancelDelete}
                style={{
                  padding: "6px 10px", fontSize: 12, fontWeight: 500, borderRadius: 6,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inactive badge */}
      {!user.isActive && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 999,
          background: "#ef444422", color: "#ef4444",
        }}>
          INACTIVE
        </div>
      )}
    </div>
  );
}

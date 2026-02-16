"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

type UserRole = "SUPERADMIN" | "ADMIN" | "OPERATOR" | "SUPER_TESTER" | "TESTER" | "DEMO" | "VIEWER";

interface User {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  assignedDomainId: string | null;
  assignedDomain: { id: string; name: string; slug: string } | null;
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
  SUPERADMIN: { bg: "#fef3c7", text: "#b45309", darkBg: "#78350f", darkText: "#fcd34d" },
  ADMIN: { bg: "#f3e8ff", text: "#7c3aed", darkBg: "#4c1d95", darkText: "#c4b5fd" },
  OPERATOR: { bg: "#dbeafe", text: "#2563eb", darkBg: "#1e3a5f", darkText: "#93c5fd" },
  EDUCATOR: { bg: "#dbeafe", text: "#1d4ed8", darkBg: "#1e3a5f", darkText: "#93c5fd" },
  SUPER_TESTER: { bg: "#d1fae5", text: "#059669", darkBg: "#064e3b", darkText: "#6ee7b7" },
  TESTER: { bg: "#ecfdf5", text: "#10b981", darkBg: "#065f46", darkText: "#a7f3d0" },
  STUDENT: { bg: "#e0f2fe", text: "#0284c7", darkBg: "#0c4a6e", darkText: "#7dd3fc" },
  DEMO: { bg: "#fef9c3", text: "#a16207", darkBg: "#713f12", darkText: "#fef08a" },
  VIEWER: { bg: "#f3f4f6", text: "#4b5563", darkBg: "#374151", darkText: "#d1d5db" },
};

function formatRoleLabel(role: string): string {
  return role.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

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
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Audit logging state
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [contractRoles, setContractRoles] = useState<string[]>([]);
  const [domainScopableRoles, setDomainScopableRoles] = useState<Set<string>>(new Set());

  // Invite preview state
  type InviteStep = "form" | "confirm" | "result";
  const [inviteStep, setInviteStep] = useState<InviteStep>("form");
  const [appConfig, setAppConfig] = useState<{ baseUrl: string; source: string } | null>(null);
  const [lastEmailSent, setLastEmailSent] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, invitesRes, auditRes, domainsRes, matrixRes, appConfigRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/invites"),
        fetch("/api/admin/audit"),
        fetch("/api/domains"),
        fetch("/api/admin/access-matrix"),
        fetch("/api/admin/app-config"),
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

      if (matrixRes.ok) {
        const data = await matrixRes.json();
        if (data.contract?.roles) {
          setContractRoles(data.contract.roles);
        }
        if (data.contract?.matrix) {
          // Derive domain-scopable roles: roles with DOMAIN or OWN scope on any entity
          const scopable = new Set<string>();
          const mtx = data.contract.matrix as Record<string, Record<string, string>>;
          for (const role of data.contract.roles || []) {
            for (const entity of Object.keys(mtx)) {
              const rule = mtx[entity]?.[role];
              if (!rule) continue;
              const scope = rule.split(":")[0];
              if (scope === "DOMAIN" || scope === "OWN") {
                scopable.add(role);
                break;
              }
            }
          }
          setDomainScopableRoles(scopable);
        }
      }

      if (appConfigRes.ok) {
        const data = await appConfigRes.json();
        setAppConfig(data);
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

  const handlePreviewInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (!newInviteEmail) {
      setInviteError("Email is required");
      return;
    }
    setInviteStep("confirm");
  };

  const handleSendInvite = async (sendEmail: boolean) => {
    setInviteError(null);

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
          sendEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to create invite");
        setInviteStep("form");
        return;
      }

      setLastInviteUrl(data.inviteUrl || null);
      setLastEmailSent(data.emailSent || false);
      setInviteStep("result");

      if (!sendEmail && data.inviteUrl) {
        try { await navigator.clipboard.writeText(data.inviteUrl); } catch {}
      }

      fetchData();
    } catch {
      setInviteError("Failed to create invite");
      setInviteStep("form");
    }
  };

  const handleResetInviteForm = () => {
    setNewInviteEmail("");
    setNewInviteFirstName("");
    setNewInviteLastName("");
    setNewInviteDomainId("");
    setInviteStep("form");
    setInviteError(null);

    setLastInviteUrl(null);
    setLastEmailSent(false);
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


  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
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

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";
  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);
  const pendingInvites = invites.filter((i) => !i.usedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <AdvancedBanner />
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Invite Field Tester
          </h2>
          {appConfig && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 6, fontSize: 12,
              background: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "#dcfce7"
                : appConfig.source === "NEXTAUTH_URL" ? "#fef9c3"
                : "#fee2e2",
              color: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "#166534"
                : appConfig.source === "NEXTAUTH_URL" ? "#854d0e"
                : "#991b1b",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%",
                background: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "#22c55e"
                  : appConfig.source === "NEXTAUTH_URL" ? "#eab308"
                  : "#ef4444",
              }} />
              Links &rarr; {appConfig.baseUrl}
            </span>
          )}
        </div>

        {inviteError && <p style={{ marginBottom: 12, fontSize: 13, color: "#ef4444", margin: "0 0 12px" }}>{inviteError}</p>}

        {/* Step 1: Form */}
        {inviteStep === "form" && (
          <form onSubmit={handlePreviewInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                {contractRoles.map((role) => (
                  <option key={role} value={role}>{formatRoleLabel(role)}</option>
                ))}
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
                Preview Invite
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirmation */}
        {inviteStep === "confirm" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              padding: 16, borderRadius: 8,
              background: "var(--surface-secondary, var(--surface-primary))",
              border: "1px solid var(--border-default)",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>Invite preview</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Email</span>
                <span style={{ color: "var(--text-primary)" }}>{newInviteEmail}</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Role</span>
                <span style={{ color: "var(--text-primary)" }}>{formatRoleLabel(newInviteRole)}</span>
                {(newInviteFirstName || newInviteLastName) && <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Name</span>
                  <span style={{ color: "var(--text-primary)" }}>{[newInviteFirstName, newInviteLastName].filter(Boolean).join(" ")}</span>
                </>}
                {newInviteDomainId && <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Domain</span>
                  <span style={{ color: "var(--text-primary)" }}>{domains.find(d => d.id === newInviteDomainId)?.name || newInviteDomainId}</span>
                </>}
              </div>
            </div>

            <div style={{
              padding: 12, borderRadius: 8,
              background: "var(--surface-secondary, var(--surface-primary))",
              border: "1px dashed var(--border-default)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Link will be</div>
              <code style={{ fontSize: 13, color: "var(--text-primary)", wordBreak: "break-all" }}>
                {appConfig?.baseUrl || "http://localhost:3000"}/invite/accept?token=&lt;generated&gt;
              </code>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setInviteStep("form")}
                style={{
                  padding: "8px 16px", fontSize: 13, borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={() => handleSendInvite(false)}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Create &amp; Copy Link
              </button>
              <button
                onClick={() => handleSendInvite(true)}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                  background: "var(--button-primary-bg)", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Create &amp; Send Email
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {inviteStep === "result" && lastInviteUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              padding: 16, borderRadius: 8,
              background: "#dcfce7", border: "1px solid #bbf7d0",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#166534", marginBottom: 8 }}>
                Invite created for {newInviteEmail}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: lastEmailSent ? "#22c55e" : "#f59e0b",
                  color: "#fff",
                }}>
                  {lastEmailSent ? "Email sent" : "Email not sent"}
                </span>
                {!lastEmailSent && (
                  <span style={{ fontSize: 12, color: "#854d0e" }}>Share the link below manually</span>
                )}
              </div>
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "#fff", border: "1px solid #bbf7d0",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <code style={{ flex: 1, fontSize: 13, color: "#166534", wordBreak: "break-all" }}>
                  {lastInviteUrl}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(lastInviteUrl); }}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6,
                    border: "1px solid #22c55e", background: "#f0fdf4",
                    color: "#166534", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleResetInviteForm}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                  background: "var(--button-primary-bg)", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Create Another
              </button>
            </div>
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
                onOpen={() => setSelectedUser(user)}
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
                onOpen={() => setSelectedUser(user)}
              />
            ))}
          </div>
        </div>
      )}

      {/* User Editor Modal */}
      {selectedUser && (
        <UserEditorModal
          user={selectedUser}
          isCurrentUser={selectedUser.id === session?.user?.id}
          domains={domains}
          roleOptions={contractRoles}
          domainScopableRoles={domainScopableRoles}
          onToggleActive={async () => {
            await handleToggleActive(selectedUser);
            setSelectedUser(null);
          }}
          onDelete={async () => {
            await handleDeleteUser(selectedUser.id);
            setSelectedUser(null);
          }}
          onClose={() => { setSelectedUser(null); fetchData(); }}
        />
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
  onOpen,
}: {
  user: User;
  isCurrentUser: boolean;
  isAdmin: boolean;
  onOpen: () => void;
}) {
  const colors = ROLE_COLORS[user.role] || ROLE_COLORS.VIEWER;

  return (
    <div
      onClick={onOpen}
      style={{
        padding: 20, borderRadius: 12, position: "relative",
        background: "var(--surface-primary)",
        border: `1px solid ${user.isActive ? "var(--border-default)" : "#ef444433"}`,
        opacity: user.isActive ? 1 : 0.6,
        cursor: "pointer",
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
      </div>

      {/* Role + meta */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          padding: "3px 10px", fontSize: 12, fontWeight: 600, borderRadius: 999,
          background: colors.bg, color: colors.text,
        }}>
          {formatRoleLabel(user.role)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user.assignedDomain && (
            <span style={{
              padding: "2px 8px", fontSize: 11, borderRadius: 4,
              background: "var(--border-default)", color: "var(--text-secondary)",
            }}>
              {user.assignedDomain.name}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

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

/* ── User Editor Modal ── */
function UserEditorModal({
  user,
  isCurrentUser,
  domains,
  roleOptions,
  domainScopableRoles,
  onToggleActive,
  onDelete,
  onClose,
}: {
  user: User;
  isCurrentUser: boolean;
  domains: Domain[];
  roleOptions: string[];
  domainScopableRoles: Set<string>;
  onToggleActive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [editName, setEditName] = useState(user.name || "");
  const [editDisplayName, setEditDisplayName] = useState(user.displayName || "");
  const [editRole, setEditRole] = useState<UserRole>(user.role);
  const [editDomainId, setEditDomainId] = useState(user.assignedDomainId || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colors = ROLE_COLORS[editRole] || ROLE_COLORS.VIEWER;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Batch: save names first, then role, then domain
      const nameChanged = editName !== (user.name || "") || editDisplayName !== (user.displayName || "");
      const roleChanged = editRole !== user.role;
      const domainChanged = editDomainId !== (user.assignedDomainId || "");

      if (nameChanged) {
        // Use the PATCH endpoint directly for all fields at once
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            ...(nameChanged ? { name: editName || null, displayName: editDisplayName || null } : {}),
            ...(roleChanged && !isCurrentUser ? { role: editRole } : {}),
            ...(domainChanged && !isCurrentUser ? { assignedDomainId: editDomainId || null } : {}),
          }),
        });
      } else if (roleChanged || domainChanged) {
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            ...(roleChanged && !isCurrentUser ? { role: editRole } : {}),
            ...(domainChanged && !isCurrentUser ? { assignedDomainId: editDomainId || null } : {}),
          }),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)", borderRadius: 16, padding: 32,
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)", border: "1px solid var(--border-default)",
          width: 480, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: getAvatarGradient(user.id),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "#fff",
          }}>
            {(user.displayName || user.name || user.email)[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
              {user.displayName || user.name || user.email.split("@")[0]}
              {isCurrentUser && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>(you)</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>
          </div>
          <span style={{
            padding: "4px 12px", fontSize: 12, fontWeight: 600, borderRadius: 999,
            background: colors.bg, color: colors.text,
          }}>
            {formatRoleLabel(editRole)}
          </span>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Full Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="First Last"
              style={{
                width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", outline: "none",
              }}
            />
          </div>

          {/* Display Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Display Name
            </label>
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="What the system calls this user"
              style={{
                width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", outline: "none",
              }}
            />
          </div>

          {/* Role */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Role
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              disabled={isCurrentUser}
              style={{
                width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary, var(--surface-primary))",
                color: "var(--text-primary)", cursor: isCurrentUser ? "not-allowed" : "pointer",
                opacity: isCurrentUser ? 0.5 : 1,
              }}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{formatRoleLabel(role)}</option>
              ))}
            </select>
            {isCurrentUser && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                You cannot change your own role
              </div>
            )}
          </div>

          {/* Domain */}
          {(domainScopableRoles.has(editRole) || editDomainId) && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Domain
              </label>
              <select
                value={editDomainId}
                onChange={(e) => setEditDomainId(e.target.value)}
                disabled={isCurrentUser}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary, var(--surface-primary))",
                  color: "var(--text-primary)", cursor: isCurrentUser ? "not-allowed" : "pointer",
                  opacity: isCurrentUser ? 0.5 : 1,
                }}
              >
                <option value="">All domains</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          {!isCurrentUser && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Status</div>
                <div style={{ fontSize: 13, color: user.isActive ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
                  {user.isActive ? "Active" : "Inactive"}
                </div>
              </div>
              <button
                onClick={onToggleActive}
                style={{
                  padding: "6px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: user.isActive ? "#f59e0b" : "#22c55e", cursor: "pointer",
                }}
              >
                {user.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          )}

          {/* Meta info */}
          <div style={{
            display: "flex", gap: 16, padding: "8px 0",
            borderTop: "1px solid var(--border-default)", fontSize: 12, color: "var(--text-muted)",
          }}>
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
              {user.id.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
          {/* Delete */}
          <div>
            {!isCurrentUser && (
              !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                    border: "1px solid #ef444444", background: "transparent",
                    color: "#ef4444", cursor: "pointer",
                  }}
                >
                  Delete User
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={onDelete}
                    style={{
                      padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: "none", background: "#ef4444", color: "#fff", cursor: "pointer",
                    }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: "8px 14px", fontSize: 13, borderRadius: 8,
                      border: "1px solid var(--border-default)", background: "transparent",
                      color: "var(--text-muted)", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )
            )}
          </div>

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 20px", fontSize: 14, borderRadius: 8,
                border: "1px solid var(--border-default)", background: "transparent",
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                padding: "8px 24px", fontSize: 14, fontWeight: 600, borderRadius: 8,
                border: "none", background: "var(--button-primary-bg)",
                color: "#fff", cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

type UserRole = "SUPERADMIN" | "ADMIN" | "OPERATOR" | "EDUCATOR" | "SUPER_TESTER" | "TESTER" | "STUDENT" | "DEMO" | "VIEWER";

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
  SUPERADMIN: { bg: "var(--badge-amber-bg)", text: "var(--badge-amber-text)", darkBg: "var(--badge-amber-bg)", darkText: "var(--badge-amber-text)" },
  ADMIN: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-text)", darkBg: "var(--badge-purple-bg)", darkText: "var(--badge-purple-text)" },
  OPERATOR: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", darkBg: "var(--badge-blue-bg)", darkText: "var(--badge-blue-text)" },
  EDUCATOR: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", darkBg: "var(--badge-blue-bg)", darkText: "var(--badge-blue-text)" },
  SUPER_TESTER: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)", darkBg: "var(--badge-green-bg)", darkText: "var(--badge-green-text)" },
  TESTER: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)", darkBg: "var(--badge-green-bg)", darkText: "var(--badge-green-text)" },
  STUDENT: { bg: "var(--badge-cyan-bg)", text: "var(--badge-cyan-text)", darkBg: "var(--badge-cyan-bg)", darkText: "var(--badge-cyan-text)" },
  DEMO: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)", darkBg: "var(--badge-yellow-bg)", darkText: "var(--badge-yellow-text)" },
  VIEWER: { bg: "var(--badge-gray-bg)", text: "var(--badge-gray-text)", darkBg: "var(--badge-gray-bg)", darkText: "var(--badge-gray-text)" },
};

function formatRoleLabel(role: string): string {
  return role.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #8b5cf6))",
  "linear-gradient(135deg, var(--accent-primary, #3b82f6), var(--badge-cyan-text, #06b6d4))",
  "linear-gradient(135deg, var(--badge-pink-text, #ec4899), var(--status-error-text, #f43f5e))",
  "linear-gradient(135deg, var(--status-warning-text, #f59e0b), var(--status-error-text, #ef4444))",
  "linear-gradient(135deg, var(--status-success-text, #10b981), var(--badge-cyan-text, #14b8a6))",
  "linear-gradient(135deg, var(--accent-secondary, #8b5cf6), var(--badge-pink-text, #ec4899))",
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
      <div className="hf-flex-center hf-p-lg">
        <div className="hf-spinner" />
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";
  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);
  const pendingInvites = invites.filter((i) => !i.usedAt);

  return (
    <div className="hf-flex-col hf-gap-2xl">
      <AdvancedBanner />
      {/* Header */}
      <div className="hf-flex-between">
        <div>
          <h1 className="hf-page-title">
            Team Members
          </h1>
          <p className="hf-page-subtitle">
            {activeUsers.length} active user{activeUsers.length !== 1 ? "s" : ""}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {session?.user && (
          <div className="hf-flex hf-gap-md">
            <div className="hf-text-right">
              <div className="hf-text-sm hf-text-500 hf-text-primary">{session.user.email}</div>
              <div className="hf-text-xs hf-text-muted">{session.user.role}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hf-btn hf-btn-secondary hf-btn-sm"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Invite New User */}
      <div className="hf-card-compact">
        <div className="hf-flex-between hf-mb-md">
          <h2 className="hf-heading-lg">
            Invite Field Tester
          </h2>
          {appConfig && (
            <span className="hf-flex hf-gap-xs" style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 12,
              background: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "var(--status-success-bg)"
                : appConfig.source === "NEXTAUTH_URL" ? "var(--status-warning-bg)"
                : "var(--status-error-bg)",
              color: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "var(--status-success-text)"
                : appConfig.source === "NEXTAUTH_URL" ? "var(--status-warning-text)"
                : "var(--status-error-text)",
            }}>
              <span className="hf-status-dot-sm" style={{
                background: appConfig.source === "NEXT_PUBLIC_APP_URL" ? "var(--status-success-text)"
                  : appConfig.source === "NEXTAUTH_URL" ? "var(--status-warning-text)"
                  : "var(--status-error-text)",
              }} />
              Links &rarr; {appConfig.baseUrl}
            </span>
          )}
        </div>

        {inviteError && <p className="hf-text-sm hf-text-error hf-mb-md">{inviteError}</p>}

        {/* Step 1: Form */}
        {inviteStep === "form" && (
          <form onSubmit={handlePreviewInvite} className="hf-flex-col hf-gap-md">
            {/* Row 1: Email + Role */}
            <div className="hf-flex hf-gap-10">
              <input
                type="email"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="tester@example.com"
                required
                className="hf-input hf-flex-1"
              />
              <select
                value={newInviteRole}
                onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                className="hf-input hf-text-sm"
                style={{ width: "auto", cursor: "pointer" }}
              >
                {contractRoles.map((role) => (
                  <option key={role} value={role}>{formatRoleLabel(role)}</option>
                ))}
              </select>
            </div>

            {/* Row 2: First/Last Name + Domain */}
            <div className="hf-flex hf-gap-10">
              <input
                type="text"
                value={newInviteFirstName}
                onChange={(e) => setNewInviteFirstName(e.target.value)}
                placeholder="First name (optional)"
                className="hf-input hf-flex-1"
              />
              <input
                type="text"
                value={newInviteLastName}
                onChange={(e) => setNewInviteLastName(e.target.value)}
                placeholder="Last name (optional)"
                className="hf-input hf-flex-1"
              />
              <select
                value={newInviteDomainId}
                onChange={(e) => setNewInviteDomainId(e.target.value)}
                className="hf-input hf-text-sm"
                style={{ width: "auto", minWidth: 160, cursor: "pointer" }}
              >
                <option value="">Any institution (chooser)</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="hf-flex hf-justify-end">
              <button
                type="submit"
                className="hf-btn hf-btn-primary"
              >
                Preview Invite
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirmation */}
        {inviteStep === "confirm" && (
          <div className="hf-flex-col hf-gap-14">
            <div className="hf-surface-box">
              <div className="hf-text-sm hf-text-muted hf-mb-sm">Invite preview</div>
              <div className="hf-preview-grid">
                <span className="hf-text-muted hf-text-bold">Email</span>
                <span className="hf-text-primary">{newInviteEmail}</span>
                <span className="hf-text-muted hf-text-bold">Role</span>
                <span className="hf-text-primary">{formatRoleLabel(newInviteRole)}</span>
                {(newInviteFirstName || newInviteLastName) && <>
                  <span className="hf-text-muted hf-text-bold">Name</span>
                  <span className="hf-text-primary">{[newInviteFirstName, newInviteLastName].filter(Boolean).join(" ")}</span>
                </>}
                {newInviteDomainId && <>
                  <span className="hf-text-muted hf-text-bold">Institution</span>
                  <span className="hf-text-primary">{domains.find(d => d.id === newInviteDomainId)?.name || newInviteDomainId}</span>
                </>}
              </div>
            </div>

            <div className="hf-surface-box-dashed">
              <div className="hf-text-xs hf-text-muted hf-mb-xs">Link will be</div>
              <code className="hf-text-sm hf-text-primary hf-word-break-all">
                {appConfig?.baseUrl || "http://localhost:3000"}/invite/accept?token=&lt;generated&gt;
              </code>
            </div>

            <div className="hf-flex hf-gap-sm hf-justify-end">
              <button
                onClick={() => setInviteStep("form")}
                className="hf-btn hf-btn-secondary hf-btn-sm"
              >
                Back
              </button>
              <button
                onClick={() => handleSendInvite(false)}
                className="hf-btn hf-btn-secondary hf-btn-sm hf-text-500"
              >
                Create &amp; Copy Link
              </button>
              <button
                onClick={() => handleSendInvite(true)}
                className="hf-btn hf-btn-primary hf-btn-sm"
              >
                Create &amp; Send Email
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {inviteStep === "result" && lastInviteUrl && (
          <div className="hf-flex-col hf-gap-14">
            <div className="hf-success-box">
              <div className="hf-text-md hf-text-bold hf-text-success hf-mb-sm">
                Invite created for {newInviteEmail}
              </div>
              <div className="hf-flex hf-gap-xs hf-mb-md">
                <span className="hf-email-badge" style={{
                  background: lastEmailSent ? "var(--status-success-text)" : "var(--status-warning-text)",
                }}>
                  {lastEmailSent ? "Email sent" : "Email not sent"}
                </span>
                {!lastEmailSent && (
                  <span className="hf-text-xs hf-text-warning">Share the link below manually</span>
                )}
              </div>
              <div className="hf-flex hf-gap-sm hf-success-link-box">
                <code className="hf-text-sm hf-text-success hf-flex-1 hf-word-break-all">
                  {lastInviteUrl}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(lastInviteUrl); }}
                  className="hf-btn hf-btn-xs hf-text-bold hf-nowrap hf-btn-success-outline"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="hf-flex hf-justify-end">
              <button
                onClick={handleResetInviteForm}
                className="hf-btn hf-btn-primary hf-btn-sm"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="hf-card-compact">
          <h2 className="hf-heading-lg hf-mb-md">
            Pending Invites
          </h2>
          <div className="hf-flex-col hf-gap-sm">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="hf-flex-between hf-dashed-box"
              >
                <div className="hf-flex hf-gap-10">
                  <div className="hf-avatar-sm hf-avatar-placeholder">
                    {invite.firstName ? invite.firstName[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="hf-text-md hf-text-500 hf-text-primary">
                      {invite.firstName || invite.lastName
                        ? `${invite.firstName || ""} ${invite.lastName || ""}`.trim()
                        : invite.email}
                    </div>
                    <div className="hf-text-xs hf-text-muted hf-flex hf-flex-wrap hf-gap-xs">
                      {invite.firstName && <span>{invite.email}</span>}
                      <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                      <span className="hf-micro-badge" style={{
                        background: ROLE_COLORS[invite.role].bg, color: ROLE_COLORS[invite.role].text,
                      }}>
                        {invite.role}
                      </span>
                      {invite.domain && (
                        <span className="hf-badge hf-badge-muted">
                          {invite.domain.name}
                        </span>
                      )}
                      <span className="hf-text-xs" style={{ color: invite.sentAt ? "var(--status-success-text)" : "var(--status-warning-text)" }}>
                        {invite.sentAt ? "Email sent" : "Not sent"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  className="hf-btn hf-btn-destructive hf-btn-xs"
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
        <h2 className="hf-heading-lg hf-mb-md">
          Active Users
        </h2>
        {activeUsers.length === 0 ? (
          <p className="hf-text-md hf-text-muted">No users yet. Send some invites!</p>
        ) : (
          <div className="hf-grid-cards">
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
          <h2 className="hf-heading-lg hf-text-muted hf-mb-md">
            Deactivated ({inactiveUsers.length})
          </h2>
          <div className="hf-grid-cards">
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
        <div className="hf-card-compact">
          <h2 className="hf-heading-lg hf-mb-md">
            Admin Settings
          </h2>

          <div className="hf-flex-between hf-settings-row">
            <div>
              <div className="hf-text-md hf-text-500 hf-text-primary">Audit Logging</div>
              <div className="hf-text-xs hf-text-muted">
                Track who does what in the system
              </div>
            </div>
            <button
              onClick={handleToggleAudit}
              disabled={auditLoading}
              className={`hf-toggle ${auditEnabled ? "hf-toggle-on" : "hf-toggle-off"}`}
              style={{ opacity: auditLoading ? 0.5 : 1, cursor: auditLoading ? "wait" : "pointer" }}
            >
              <span className="hf-toggle-knob" style={{ left: auditEnabled ? 20 : 2 }} />
            </button>
          </div>

          {auditEnabled && (
            <div className="hf-mt-md">
              <button
                onClick={() => setShowAuditLogs(!showAuditLogs)}
                className="hf-text-sm hf-toggle-link"
              >
                {showAuditLogs ? "Hide" : "Show"} Recent Activity ({auditLogs.length} logs)
              </button>

              {showAuditLogs && auditLogs.length > 0 && (
                <div className="hf-audit-table-wrap">
                  <table className="hf-audit-table">
                    <thead>
                      <tr>
                        <th className="hf-audit-th">Time</th>
                        <th className="hf-audit-th">User</th>
                        <th className="hf-audit-th">Action</th>
                        <th className="hf-audit-th">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 50).map((log) => (
                        <tr key={log.id} className="hf-audit-tr">
                          <td className="hf-audit-td hf-text-muted">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="hf-audit-td hf-text-primary">
                            {log.userEmail || "System"}
                          </td>
                          <td className="hf-audit-td">
                            <span className="hf-badge hf-badge-muted">
                              {log.action}
                            </span>
                          </td>
                          <td className="hf-audit-td hf-text-muted">
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
                <p className="hf-text-sm hf-text-muted hf-mt-md">
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
      className={`hf-user-card${user.isActive ? "" : " hf-user-card-inactive"}`}
    >
      {/* Top row: avatar + name */}
      <div className="hf-flex hf-gap-md hf-mb-md">
        <div className="hf-avatar" style={{ background: getAvatarGradient(user.id) }}>
          {(user.displayName || user.name || user.email)[0].toUpperCase()}
        </div>
        <div className="hf-min-w-0 hf-flex-1">
          <div className="hf-section-title hf-truncate">
            {user.displayName || user.name || user.email.split("@")[0]}
            {isCurrentUser && (
              <span className="hf-text-xs hf-text-muted hf-you-tag">(you)</span>
            )}
          </div>
          <div className="hf-text-xs hf-text-muted hf-truncate">
            {user.email}
          </div>
        </div>
      </div>

      {/* Role + meta */}
      <div className="hf-flex-between">
        <span className="hf-role-pill" style={{ background: colors.bg, color: colors.text }}>
          {formatRoleLabel(user.role)}
        </span>
        <div className="hf-flex hf-gap-sm">
          {user.assignedDomain && (
            <span className="hf-badge hf-badge-muted">
              {user.assignedDomain.name}
            </span>
          )}
          <span className="hf-text-xs hf-text-muted">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Inactive badge */}
      {!user.isActive && (
        <div className="hf-inactive-badge">
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
      className="hf-modal-overlay-blur"
      onClick={onClose}
    >
      <div
        className="hf-user-editor"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hf-flex hf-mb-lg hf-gap-14">
          <div className="hf-avatar-lg" style={{ background: getAvatarGradient(user.id) }}>
            {(user.displayName || user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="hf-flex-1 hf-min-w-0">
            <div className="hf-heading-modal">
              {user.displayName || user.name || user.email.split("@")[0]}
              {isCurrentUser && (
                <span className="hf-text-xs hf-text-muted hf-you-tag">(you)</span>
              )}
            </div>
            <div className="hf-text-sm hf-text-muted">{user.email}</div>
          </div>
          <span className="hf-role-pill" style={{
            padding: "4px 12px",
            background: colors.bg, color: colors.text,
          }}>
            {formatRoleLabel(editRole)}
          </span>
        </div>

        {/* Form */}
        <div className="hf-flex-col hf-gap-lg">
          {/* Full Name */}
          <div>
            <label className="hf-label">
              Full Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="First Last"
              className="hf-input"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="hf-label">
              Display Name
            </label>
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="What the system calls this user"
              className="hf-input"
            />
          </div>

          {/* Role */}
          <div>
            <label className="hf-label">
              Role
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              disabled={isCurrentUser}
              className="hf-input"
              style={{
                cursor: isCurrentUser ? "not-allowed" : "pointer",
                opacity: isCurrentUser ? 0.5 : 1,
              }}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{formatRoleLabel(role)}</option>
              ))}
            </select>
            {isCurrentUser && (
              <div className="hf-text-xs hf-text-muted hf-mt-sm">
                You cannot change your own role
              </div>
            )}
          </div>

          {/* Domain */}
          {(domainScopableRoles.has(editRole) || editDomainId) && (
            <div>
              <label className="hf-label">
                Domain
              </label>
              <select
                value={editDomainId}
                onChange={(e) => setEditDomainId(e.target.value)}
                disabled={isCurrentUser}
                className="hf-input"
                style={{
                  cursor: isCurrentUser ? "not-allowed" : "pointer",
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
            <div className="hf-flex-between hf-p-sm">
              <div>
                <div className="hf-label hf-mb-0">Status</div>
                <div className={`hf-text-sm hf-text-500 ${user.isActive ? "hf-text-success" : "hf-text-error"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </div>
              </div>
              <button
                onClick={onToggleActive}
                className="hf-btn hf-btn-secondary hf-btn-sm"
                style={{ color: user.isActive ? "var(--status-warning-text)" : "var(--status-success-text)" }}
              >
                {user.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          )}

          {/* Meta info */}
          <div className="hf-flex hf-gap-lg hf-text-xs hf-text-muted hf-p-sm hf-border-top">
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            <span className="hf-mono">
              {user.id.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="hf-flex-between hf-mt-md">
          {/* Delete */}
          <div>
            {!isCurrentUser && (
              !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="hf-btn hf-btn-destructive hf-btn-sm"
                >
                  Delete User
                </button>
              ) : (
                <div className="hf-flex hf-gap-xs">
                  <button
                    onClick={onDelete}
                    className="hf-btn hf-btn-sm hf-text-bold hf-btn-confirm-delete"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="hf-btn hf-btn-secondary hf-btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              )
            )}
          </div>

          {/* Save / Cancel */}
          <div className="hf-flex hf-gap-sm">
            <button
              onClick={onClose}
              className="hf-btn hf-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="hf-btn hf-btn-primary hf-text-bold"
              style={{
                cursor: saving ? "wait" : "pointer",
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

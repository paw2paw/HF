"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
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

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Audit logging state
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, invitesRes, auditRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/invites"),
        fetch("/api/admin/audit"),
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
        // Refresh to get any new logs
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

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newInviteEmail, role: "ADMIN" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to create invite");
        return;
      }

      setInviteSuccess(`Invite created for ${newInviteEmail}`);
      setNewInviteEmail("");
      fetchData();
    } catch (err) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team Members</h1>
          <p className="mt-1 text-neutral-500">
            Manage users and invites for HF Admin
          </p>
        </div>

        {/* Current user info */}
        {session?.user && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{session.user.email}</div>
              <div className="text-xs text-neutral-500">
                {session.user.role}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Invite New User */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-medium">Invite New User</h2>
        <form onSubmit={handleCreateInvite} className="flex gap-3">
          <input
            type="email"
            value={newInviteEmail}
            onChange={(e) => setNewInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            Send Invite
          </button>
        </form>

        {inviteError && (
          <p className="mt-3 text-sm text-red-500">{inviteError}</p>
        )}
        {inviteSuccess && (
          <p className="mt-3 text-sm text-green-500">{inviteSuccess}</p>
        )}
      </div>

      {/* Pending Invites */}
      {invites.filter((i) => !i.usedAt).length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-lg font-medium">Pending Invites</h2>
          <div className="space-y-2">
            {invites
              .filter((i) => !i.usedAt)
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-700"
                >
                  <div>
                    <div className="font-medium">{invite.email}</div>
                    <div className="text-sm text-neutral-500">
                      Expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteInvite(invite.id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Revoke
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Active Users */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-medium">Active Users</h2>
        <div className="space-y-2">
          {users.length === 0 ? (
            <p className="text-neutral-500">No users yet. Send some invites!</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  user.isActive
                    ? "border-neutral-200 dark:border-neutral-700"
                    : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.name || user.email}
                      {user.id === session?.user?.id && (
                        <span className="ml-2 text-xs text-neutral-500">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-500">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        : user.role === "OPERATOR"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {user.role}
                  </span>

                  {user.id !== session?.user?.id && (
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`text-sm ${
                        user.isActive
                          ? "text-red-500 hover:text-red-600"
                          : "text-green-500 hover:text-green-600"
                      }`}
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Settings */}
      {session?.user?.role === "ADMIN" && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-lg font-medium">Admin Settings</h2>

          {/* Audit Logging Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <div>
              <div className="font-medium">Audit Logging</div>
              <div className="text-sm text-neutral-500">
                Track who does what in the system (logins, pipeline runs, edits)
              </div>
            </div>
            <button
              onClick={handleToggleAudit}
              disabled={auditLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                auditEnabled
                  ? "bg-green-500"
                  : "bg-neutral-300 dark:bg-neutral-600"
              } ${auditLoading ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  auditEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Show Audit Logs */}
          {auditEnabled && (
            <div className="mt-4">
              <button
                onClick={() => setShowAuditLogs(!showAuditLogs)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showAuditLogs ? "Hide" : "Show"} Recent Activity ({auditLogs.length} logs)
              </button>

              {showAuditLogs && auditLogs.length > 0 && (
                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                      {auditLogs.slice(0, 50).map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                          <td className="px-3 py-2 text-neutral-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            {log.userEmail || "System"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-700">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-neutral-500">
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
                <p className="mt-3 text-sm text-neutral-500">
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

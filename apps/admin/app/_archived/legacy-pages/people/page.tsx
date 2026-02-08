"use client";

import { useApi } from "@/hooks/useApi";

type User = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  _count?: {
    calls: number;
    personalityObservations: number;
  };
};

export default function UsersPage() {
  const { data: users, loading, error } = useApi<User[]>(
    "/api/users",
    { transform: (res) => (res.users as User[]) || [] }
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Users</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Manage users and their profiles
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : (users || []).length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No users yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Users are created when processing transcripts
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Name
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Email
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  External ID
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Calls
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    {user.name || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#6b7280" }}>
                    {user.email || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>
                    {user.externalId || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, textAlign: "center" }}>
                    {user._count?.calls || 0}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type Playbook = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  domain: Domain;
  _count: { items: number };
};

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "", domainId: "" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "DRAFT" | "PUBLISHED" | "ARCHIVED">("all");
  const [filterDomain, setFilterDomain] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/playbooks").then(r => r.json()),
      fetch("/api/domains").then(r => r.json()),
    ]).then(([pb, dom]) => {
      if (pb.ok) setPlaybooks(pb.playbooks || []);
      if (dom.ok) setDomains(dom.domains || []);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!newPlaybook.name || !newPlaybook.domainId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlaybook),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybooks([...playbooks, data.playbook]);
        setShowCreate(false);
        setNewPlaybook({ name: "", description: "", domainId: "" });
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: "var(--badge-yellow-bg)", text: "var(--status-warning-text)" },
    PUBLISHED: { bg: "var(--badge-green-bg)", text: "var(--status-success-text)" },
    ARCHIVED: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
  };

  // Filter playbooks
  const filteredPlaybooks = playbooks.filter((pb) => {
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      const matchesSearch =
        pb.name.toLowerCase().includes(s) ||
        pb.description?.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }
    // Status filter
    if (filterStatus !== "all" && pb.status !== filterStatus) return false;
    // Domain filter
    if (filterDomain && pb.domain.id !== filterDomain) return false;
    return true;
  });

  // Group by domain
  const groupedByDomain = filteredPlaybooks.reduce((acc, pb) => {
    const domainName = pb.domain.name;
    if (!acc[domainName]) acc[domainName] = [];
    acc[domainName].push(pb);
    return acc;
  }, {} as Record<string, Playbook[]>);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Playbooks</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Bundles of specs and templates per domain
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "10px 16px",
            background: "var(--button-primary-bg)",
            color: "var(--surface-primary)",
            border: "none",
            borderRadius: 8,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New Playbook
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search playbooks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="all">All status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : filteredPlaybooks.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
            {search || filterStatus !== "all" || filterDomain ? "No playbooks match filters" : "No playbooks yet"}
          </div>
          {!search && filterStatus === "all" && !filterDomain && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: 16,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--surface-primary)",
                border: "none",
                borderRadius: 8,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Create First Playbook
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(groupedByDomain)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([domainName, playbooksInDomain]) => (
              <div key={domainName}>
                <h2 style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  {domainName}
                  <span style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--text-placeholder)",
                    fontWeight: 400,
                    textTransform: "none",
                    letterSpacing: "normal"
                  }}>
                    ({playbooksInDomain.length})
                  </span>
                </h2>
                <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                  {playbooksInDomain.map((pb) => (
                    <Link
                      key={pb.id}
                      href={`/x/playbooks/${pb.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          transition: "background-color 0.15s",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{pb.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: statusColors[pb.status]?.bg,
                              color: statusColors[pb.status]?.text,
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            {pb.status}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>v{pb.version}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {pb._count.items} items
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ background: "var(--modal-bg)", borderRadius: 12, padding: 24, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18 }}>New Playbook</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Domain</label>
              <select
                value={newPlaybook.domainId}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, domainId: e.target.value })}
                style={{ width: "100%", padding: 10, border: "1px solid var(--input-border)", borderRadius: 6 }}
              >
                <option value="">Select...</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={newPlaybook.name}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, name: e.target.value })}
                style={{ width: "100%", padding: 10, border: "1px solid var(--input-border)", borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: "8px 16px", background: "var(--surface-secondary)", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newPlaybook.name || !newPlaybook.domainId}
                style={{
                  padding: "8px 16px",
                  background: "var(--button-primary-bg)",
                  color: "var(--surface-primary)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

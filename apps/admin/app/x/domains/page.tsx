"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Domain = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  callerCount: number;
  playbookCount: number;
  publishedPlaybook: {
    id: string;
    name: string;
    version: string;
    publishedAt: string;
  } | null;
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDomain, setNewDomain] = useState({ slug: "", name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "callers" | "playbooks">("name");

  const fetchDomains = () => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDomains(data.domains || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleCreate = async () => {
    if (!newDomain.slug || !newDomain.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreate(false);
        setNewDomain({ slug: "", name: "", description: "" });
        fetchDomains();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (domain: Domain) => {
    if (!domain.isActive) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
          Inactive
        </span>
      );
    }
    if (domain.isDefault) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 4 }}>
          Default
        </span>
      );
    }
    return null;
  };

  // Filter and sort domains
  const filteredAndSortedDomains = domains
    .filter((domain) => {
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch =
          domain.name.toLowerCase().includes(s) ||
          domain.slug.toLowerCase().includes(s) ||
          domain.description?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (filterStatus === "active" && !domain.isActive) return false;
      if (filterStatus === "inactive" && domain.isActive) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "callers":
          return b.callerCount - a.callerCount;
        case "playbooks":
          return b.playbookCount - a.playbookCount;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>Domains</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Segment callers by domain (Tutor, Support, Sales, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "10px 16px",
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New Domain
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search domains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="all">All status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "callers" | "playbooks")}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="name">Sort by name</option>
          <option value="callers">Most callers</option>
          <option value="playbooks">Most playbooks</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredAndSortedDomains.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            {search || filterStatus !== "all" ? "No domains match filters" : "No domains yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredAndSortedDomains.map((domain) => (
            <Link
              key={domain.id}
              href={`/x/domains/${domain.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 20,
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#4f46e5";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(79, 70, 229, 0.1)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{domain.name}</h3>
                  {statusBadge(domain)}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                  {domain.description || <em>No description</em>}
                </p>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
                  <span><strong>{domain.callerCount || 0}</strong> callers</span>
                  <span><strong>{domain.playbookCount || 0}</strong> playbooks</span>
                </div>
                {domain.publishedPlaybook && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      background: "#f0fdf4",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "#166534", fontWeight: 500 }}>Published:</span>{" "}
                    <span style={{ color: "#15803d" }}>
                      {domain.publishedPlaybook.name} v{domain.publishedPlaybook.version}
                    </span>
                  </div>
                )}
                {!domain.publishedPlaybook && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      background: "#fef3c7",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#92400e",
                    }}
                  >
                    No published playbook
                  </div>
                )}
              </div>
            </Link>
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
            style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18 }}>New Domain</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Slug</label>
              <input
                type="text"
                value={newDomain.slug}
                onChange={(e) => setNewDomain({ ...newDomain, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                placeholder="e.g., tutor"
                style={{ width: "100%", padding: 10, border: "1px solid #d1d5db", borderRadius: 6 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={newDomain.name}
                onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                placeholder="e.g., AI Tutor"
                style={{ width: "100%", padding: 10, border: "1px solid #d1d5db", borderRadius: 6 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Description</label>
              <textarea
                value={newDomain.description}
                onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                rows={2}
                style={{ width: "100%", padding: 10, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newDomain.slug || !newDomain.name}
                style={{
                  padding: "8px 16px",
                  background: "#4f46e5",
                  color: "#fff",
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

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FancySelect } from "@/components/shared/FancySelect";
import { DomainPill } from "@/src/components/shared/EntityPill";
import { School, Plus, Users, Phone, Target } from "lucide-react";

type CohortGroup = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  maxMembers: number;
  createdAt: string;
  owner: { id: string; name: string; email: string | null };
  domain: { id: string; slug: string; name: string };
  _count: { members: number };
};

type CohortsResponse = {
  cohorts: CohortGroup[];
  total: number;
};

type Domain = {
  id: string;
  slug: string;
  name: string;
};

export default function CohortsPage() {
  const [search, setSearch] = useState("");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterActive, setFilterActive] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch domains for filter
  const { data: domainsData } = useApi<{ domains: Domain[] }>("/api/domains", {
    transform: (res) => ({ domains: res.domains || [] }),
  });
  const domains = domainsData?.domains || [];

  // Fetch cohorts
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterDomain !== "all") params.set("domainId", filterDomain);
    if (filterActive === "active") params.set("isActive", "true");
    if (filterActive === "inactive") params.set("isActive", "false");
    return `/api/cohorts?${params}`;
  }, [filterDomain, filterActive]);

  const {
    data: cohortsData,
    loading,
    error,
    refetch,
  } = useApi<CohortsResponse>(
    apiUrl,
    {
      transform: (res) => ({
        cohorts: (res.cohorts || []) as CohortGroup[],
        total: (res.total || 0) as number,
      }),
    },
    [filterDomain, filterActive]
  );

  const cohorts = cohortsData?.cohorts || [];

  // Client-side search filter
  const filtered = cohorts.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      c.owner.name.toLowerCase().includes(s) ||
      c.domain.name.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <School size={22} style={{ color: "var(--text-secondary)" }} />
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Cohorts
            </h1>
            {cohortsData && (
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  background: "var(--surface-tertiary)",
                  borderRadius: 10,
                  color: "var(--text-muted)",
                }}
              >
                {cohortsData.total}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            Manage teacher and tutor cohort groups
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--button-primary-bg)",
            color: "var(--button-primary-text)",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={14} />
          New Cohort
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search cohorts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
            width: 220,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        />
        <FancySelect
          value={filterDomain}
          onChange={setFilterDomain}
          searchable={false}
          style={{ minWidth: 160 }}
          options={[
            { value: "all", label: "All Domains" },
            ...domains.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
        <FancySelect
          value={filterActive}
          onChange={setFilterActive}
          searchable={false}
          style={{ minWidth: 140 }}
          options={[
            { value: "all", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 16,
            background: "var(--status-error-bg)",
            color: "var(--status-error-text)",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--surface-secondary)",
            borderRadius: 12,
            border: "1px solid var(--border-default)",
          }}
        >
          <School
            size={48}
            style={{ color: "var(--text-placeholder)", marginBottom: 16 }}
          />
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {search || filterDomain !== "all"
              ? "No cohorts match filters"
              : "No cohorts yet"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 8,
            }}
          >
            Create a cohort to group pupils under a teacher or tutor
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((cohort) => (
            <Link
              key={cohort.id}
              href={`/x/cohorts/${cohort.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#4338ca";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px color-mix(in srgb, #4338ca 15%, transparent)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {cohort.name}
                    </h3>
                    {cohort.description && (
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        {cohort.description.length > 80
                          ? cohort.description.slice(0, 80) + "..."
                          : cohort.description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: cohort.isActive
                        ? "color-mix(in srgb, #10b981 15%, transparent)"
                        : "var(--surface-tertiary)",
                      color: cohort.isActive ? "#10b981" : "var(--text-muted)",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {cohort.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Stats Row */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Users size={14} />
                    <span style={{ fontWeight: 600 }}>
                      {cohort._count.members}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      / {cohort.maxMembers}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <DomainPill label={cohort.domain.name} size="compact" />
                  <span
                    style={{ fontSize: 11, color: "var(--text-placeholder)" }}
                  >
                    Owner: {cohort.owner.name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCohortModal
          domains={domains}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ==============================
// Create Cohort Modal
// ==============================

function CreateCohortModal({
  domains,
  onClose,
  onCreated,
}: {
  domains: Domain[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id || "");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Search for teacher/tutor owners
  const {
    data: ownerResults,
    loading: searchingOwners,
  } = useApi<{ callers: { id: string; name: string; role: string }[] }>(
    ownerSearch.length >= 2
      ? `/api/callers?role=TEACHER&limit=10&withCounts=false`
      : "",
    {
      skip: ownerSearch.length < 2,
      transform: (res) => ({
        callers: (res.callers || []).filter(
          (c: any) =>
            c.name?.toLowerCase().includes(ownerSearch.toLowerCase()) &&
            (c.role === "TEACHER" || c.role === "TUTOR")
        ),
      }),
    },
    [ownerSearch]
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!ownerId) {
      setError("Select a teacher or tutor as owner");
      return;
    }
    if (!domainId) {
      setError("Select a domain");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          domainId,
          ownerId,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to create cohort");
        setCreating(false);
        return;
      }
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create cohort");
      setCreating(false);
    }
  };

  return (
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 12,
          padding: 24,
          width: 440,
          maxWidth: "90vw",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px 0",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Create Cohort
        </h2>

        {error && (
          <div
            style={{
              padding: 10,
              background: "var(--status-error-bg)",
              color: "var(--status-error-text)",
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Name */}
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Year 10 Science"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 12,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            boxSizing: "border-box",
          }}
        />

        {/* Description */}
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          rows={2}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 12,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {/* Domain */}
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          Domain
        </label>
        <FancySelect
          value={domainId}
          onChange={setDomainId}
          searchable={false}
          style={{ marginBottom: 12, width: "100%" }}
          options={domains.map((d) => ({ value: d.id, label: d.name }))}
        />

        {/* Owner search */}
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          Owner (Teacher / Tutor)
        </label>
        {ownerId ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface-secondary)",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              {ownerName}
            </span>
            <button
              onClick={() => {
                setOwnerId("");
                setOwnerName("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Search teachers/tutors by name..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--input-border)",
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 4,
                background: "var(--surface-primary)",
                color: "var(--text-primary)",
                boxSizing: "border-box",
              }}
            />
            {ownerSearch.length >= 2 && (
              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  marginBottom: 12,
                }}
              >
                {searchingOwners ? (
                  <div
                    style={{
                      padding: 8,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    Searching...
                  </div>
                ) : ownerResults?.callers.length === 0 ? (
                  <div
                    style={{
                      padding: 8,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    No teachers/tutors found
                  </div>
                ) : (
                  ownerResults?.callers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setOwnerId(c.id);
                        setOwnerName(c.name);
                        setOwnerSearch("");
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 13,
                        borderBottom: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.background =
                          "var(--surface-secondary)")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {c.name}{" "}
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                        }}
                      >
                        ({c.role})
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating..." : "Create Cohort"}
          </button>
        </div>
      </div>
    </div>
  );
}

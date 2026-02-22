"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FancySelect } from "@/components/shared/FancySelect";
import { DomainPill } from "@/src/components/shared/EntityPill";
import { School, Plus, Users, Phone, Target } from "lucide-react";
import { useSession } from "next-auth/react";
import "./cohorts.css";

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: session } = useSession();
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/cohorts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete");
      refetch();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

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
      <div className="ch-header">
        <div>
          <div className="ch-header-left">
            <School size={22} className="ch-header-icon" />
            <h1 className="hf-page-title">Cohorts</h1>
            {cohortsData && (
              <span className="ch-count-badge">{cohortsData.total}</span>
            )}
          </div>
          <p className="hf-page-subtitle hf-text-muted">
            Manage teacher and tutor cohort groups
          </p>
        </div>
        {isOperator && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="hf-btn hf-btn-primary"
          >
            <Plus size={14} />
            New Cohort
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="ch-filters">
        <input
          type="text"
          placeholder="Search cohorts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ch-search-input"
        />
        <FancySelect
          value={filterDomain}
          onChange={setFilterDomain}
          searchable={false}
          style={{ minWidth: 160 }}
          options={[
            { value: "all", label: "All Institutions" },
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

      {/* Delete error */}
      {deleteError && (
        <div className="hf-banner hf-banner-error hf-flex-between">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="hf-btn-ghost ch-banner-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="ch-error">{error}</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="ch-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="ch-empty">
          <School size={48} className="ch-empty-icon" />
          <div className="ch-empty-title">
            {search || filterDomain !== "all"
              ? "No cohorts match filters"
              : "No cohorts yet"}
          </div>
          <div className="ch-empty-desc">
            Create a cohort to group pupils under a teacher or tutor
          </div>
        </div>
      ) : (
        <div className="ch-grid">
          {filtered.map((cohort) => (
            <Link
              key={cohort.id}
              href={`/x/cohorts/${cohort.id}`}
              className="ch-card-link"
            >
              <div className="ch-card">
                {/* Card Header */}
                <div className="ch-card-header">
                  <div>
                    <h3 className="ch-card-name">{cohort.name}</h3>
                    {cohort.description && (
                      <p className="ch-card-desc">
                        {cohort.description.length > 80
                          ? cohort.description.slice(0, 80) + "..."
                          : cohort.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`ch-status-badge ${cohort.isActive ? "ch-status-active" : "ch-status-inactive"}`}
                  >
                    {cohort.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Stats Row */}
                <div className="ch-stats">
                  <div className="ch-stat-item">
                    <Users size={14} />
                    <span className="ch-stat-value">
                      {cohort._count.members}
                    </span>
                    <span className="ch-stat-max">
                      / {cohort.maxMembers}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="ch-card-footer">
                  <DomainPill label={cohort.domain.name} size="compact" />
                  <span className="ch-owner-label">
                    Owner: {cohort.owner.name}
                  </span>
                </div>

                {/* Delete action */}
                {isOperator && (
                  <div
                    className="ch-delete-area"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  >
                    {confirmDeleteId === cohort.id ? (
                      <div className="ch-delete-confirm">
                        <span className="ch-delete-warning">
                          Permanently delete this cohort?
                        </span>
                        <button
                          onClick={() => handleDelete(cohort.id)}
                          disabled={deleting}
                          className="hf-btn hf-btn-destructive"
                        >
                          {deleting ? "..." : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="hf-btn hf-btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(cohort.id)}
                        className="hf-btn-ghost ch-delete-btn"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
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
      setError("Select an institution");
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
      className="ch-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ch-modal">
        <h2 className="ch-modal-title">Create Cohort</h2>

        {error && (
          <div className="ch-modal-error">{error}</div>
        )}

        {/* Name */}
        <label className="ch-modal-label">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Year 10 Science"
          className="ch-modal-input"
        />

        {/* Description */}
        <label className="ch-modal-label">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          rows={2}
          className="ch-modal-textarea"
        />

        {/* Domain */}
        <label className="ch-modal-label">Institution</label>
        <FancySelect
          value={domainId}
          onChange={setDomainId}
          searchable={false}
          style={{ marginBottom: 12, width: "100%" }}
          options={domains.map((d) => ({ value: d.id, label: d.name }))}
        />

        {/* Owner search */}
        <label className="ch-modal-label">Owner (Teacher / Tutor)</label>
        {ownerId ? (
          <div className="ch-owner-selected">
            <span className="ch-owner-name">{ownerName}</span>
            <button
              onClick={() => {
                setOwnerId("");
                setOwnerName("");
              }}
              className="ch-owner-change"
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
              className="ch-modal-input ch-modal-input-tight"
            />
            {ownerSearch.length >= 2 && (
              <div className="ch-owner-dropdown">
                {searchingOwners ? (
                  <div className="ch-owner-dropdown-empty">Searching...</div>
                ) : ownerResults?.callers.length === 0 ? (
                  <div className="ch-owner-dropdown-empty">No teachers/tutors found</div>
                ) : (
                  ownerResults?.callers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setOwnerId(c.id);
                        setOwnerName(c.name);
                        setOwnerSearch("");
                      }}
                      className="ch-owner-option"
                    >
                      {c.name}{" "}
                      <span className="ch-owner-role">({c.role})</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="ch-modal-actions">
          <button onClick={onClose} className="ch-modal-cancel">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="ch-modal-submit"
          >
            {creating ? "Creating..." : "Create Cohort"}
          </button>
        </div>
      </div>
    </div>
  );
}

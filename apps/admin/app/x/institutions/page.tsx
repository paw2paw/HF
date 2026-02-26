"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, BookOpen, ChevronRight } from "lucide-react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import { useSession } from "next-auth/react";
import "./institutions.css";

interface Institution {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
  userCount: number;
  cohortCount: number;
  createdAt: string;
}

const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function SkeletonCard() {
  return (
    <div className="inst-skeleton-card">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div className="hf-skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="hf-skeleton hf-skeleton-text" style={{ width: "60%", marginBottom: 6 }} />
          <div className="hf-skeleton hf-skeleton-text" style={{ width: "35%" }} />
        </div>
        <div className="hf-skeleton" style={{ width: 50, height: 20, borderRadius: 10 }} />
      </div>
      <div className="hf-skeleton hf-skeleton-text" style={{ width: "75%", marginBottom: 14 }} />
      <div style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
        <div className="hf-skeleton hf-skeleton-text" style={{ width: 80, height: 28 }} />
      </div>
    </div>
  );
}

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: session } = useSession();
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const handleDeactivate = async (id: string) => {
    setDeactivating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/institutions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to deactivate");
      setInstitutions((prev) => prev.map((i) => i.id === id ? { ...i, isActive: false } : i));
    } catch (err: any) {
      setActionError(err.message || "Failed to deactivate");
    } finally {
      setDeactivating(false);
      setConfirmDeactivateId(null);
    }
  };

  useEffect(() => {
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((res) => { if (res.ok) setInstitutions(res.institutions); })
      .finally(() => setLoading(false));
  }, []);

  const activeCount = institutions.filter((i) => i.isActive).length;
  const totalUsers = institutions.reduce((sum, i) => sum + i.userCount, 0);

  return (
    <div className="inst-page">
      <AdvancedBanner />

      <div className="inst-header">
        <div>
          <h1 className="hf-page-title" style={{ marginBottom: 4 }}>Institutions</h1>
          <p className="hf-page-subtitle">Manage schools and organizations</p>
        </div>
        {isOperator && (
          <Link href="/x/institutions/new" className="hf-btn hf-btn-primary">
            + New Institution
          </Link>
        )}
      </div>

      {actionError && (
        <div className="hf-banner hf-banner-error" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="hf-btn-ghost"
            style={{ padding: 0, fontSize: 12, color: "inherit", textDecoration: "underline" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && institutions.length > 0 && (
        <div className="hf-summary-strip">
          <div className="hf-summary-card">
            <span className="hf-summary-value">{institutions.length}</span>
            <span className="hf-summary-label">Total</span>
          </div>
          <div className="hf-summary-card">
            <span className="hf-summary-value" style={{ color: "var(--status-success-text)" }}>{activeCount}</span>
            <span className="hf-summary-label">Active</span>
          </div>
          <div className="hf-summary-card">
            <span className="hf-summary-value">{institutions.length - activeCount}</span>
            <span className="hf-summary-label">Inactive</span>
          </div>
          <div className="hf-summary-card">
            <span className="hf-summary-value">{totalUsers}</span>
            <span className="hf-summary-label">Total Users</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="inst-skeleton-grid">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : institutions.length === 0 ? (
        <div className="inst-empty">
          <Building2 size={40} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            No institutions yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Create your first institution to enable branded experiences for schools.
          </p>
          {isOperator && (
            <Link href="/x/institutions/new" className="hf-btn hf-btn-primary">
              Create Institution
            </Link>
          )}
        </div>
      ) : (
        <div className="inst-grid">
          {institutions.map((inst) => {
            const initColor = inst.primaryColor || hashColor(inst.name);
            return (
              <div key={inst.id} className="inst-card">
                <div className="inst-card-header">
                  {inst.logoUrl ? (
                    <img src={inst.logoUrl} alt={inst.name} className="inst-card-avatar" />
                  ) : (
                    <div className="inst-card-initial" style={{ background: initColor }}>
                      {inst.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="inst-card-title-block">
                    <div className="inst-card-name">{inst.name}</div>
                    <div className="inst-card-slug">{inst.slug}</div>
                  </div>
                  <div className="inst-card-badge-col">
                    <span className={`hf-badge ${inst.isActive ? "hf-badge-success" : "hf-badge-muted"}`}>
                      {inst.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {inst.primaryColor && (
                  <div className="inst-card-swatches">
                    <span className="inst-card-swatch" style={{ background: inst.primaryColor }} />
                  </div>
                )}

                <div className="inst-card-stats">
                  <span className="inst-card-stat">
                    <BookOpen size={12} />
                    <strong>{inst.cohortCount}</strong> classrooms
                  </span>
                  <span className="inst-card-stat">
                    <Users size={12} />
                    <strong>{inst.userCount}</strong> users
                  </span>
                </div>

                <div className="inst-card-footer">
                  {isSuperAdmin && inst.isActive && (
                    confirmDeactivateId === inst.id ? (
                      <div className="inst-card-confirm">
                        <button
                          onClick={() => handleDeactivate(inst.id)}
                          disabled={deactivating}
                          className="hf-btn hf-btn-destructive"
                          style={{ padding: "2px 10px", fontSize: 11 }}
                        >
                          {deactivating ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeactivateId(null)}
                          className="hf-btn hf-btn-secondary"
                          style={{ padding: "2px 10px", fontSize: 11 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeactivateId(inst.id)}
                        className="hf-btn hf-btn-ghost"
                        style={{ fontSize: 12 }}
                      >
                        Deactivate
                      </button>
                    )
                  )}
                  <Link
                    href={`/x/institutions/${inst.id}`}
                    className="hf-btn hf-btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}
                  >
                    Manage <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

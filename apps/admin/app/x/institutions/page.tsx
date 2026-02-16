"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

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

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setInstitutions(res.institutions);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 14 }}>
        Loading institutions...
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <AdvancedBanner />
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Institutions
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Manage schools and organizations
          </p>
        </div>
        <Link
          href="/x/institutions/new"
          style={{
            padding: "10px 16px",
            background: "var(--button-primary-bg)",
            color: "var(--button-primary-text)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + New Institution
        </Link>
      </div>

      {institutions.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            No institutions yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Create your first institution to enable branded experiences for schools.
          </p>
          <Link
            href="/x/institutions/new"
            style={{
              padding: "10px 20px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create Institution
          </Link>
        </div>
      ) : (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--table-header-bg)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Institution
                </th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Slug
                </th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Users
                </th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cohorts
                </th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.id} style={{ borderTop: "1px solid var(--table-row-border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {inst.primaryColor && (
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: inst.primaryColor,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Link
                        href={`/x/institutions/${inst.id}`}
                        style={{ color: "var(--accent-primary)", textDecoration: "none", fontWeight: 500, fontSize: 14 }}
                      >
                        {inst.name}
                      </Link>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13, fontFamily: "monospace" }}>
                    {inst.slug}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                    {inst.userCount}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                    {inst.cohortCount}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: inst.isActive
                          ? "color-mix(in srgb, var(--status-success-text) 12%, transparent)"
                          : "color-mix(in srgb, var(--text-muted) 12%, transparent)",
                        color: inst.isActive ? "var(--status-success-text)" : "var(--text-muted)",
                      }}
                    >
                      {inst.isActive ? "Active" : "Inactive"}
                    </span>
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

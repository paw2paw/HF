"use client";

/**
 * Holographic Page — Domain Resolver
 *
 * Sidebar entry point. Fetches the user's domain(s) and:
 * - If exactly one domain → redirects to /x/institutions/{id}/holo
 * - If multiple → shows a picker
 * - If none → shows empty state with create link
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, Plus, Loader2 } from "lucide-react";
import "../institutions/[id]/holo/holographic-page.css";

interface DomainItem {
  id: string;
  name: string;
  slug: string;
  institution?: { name: string } | null;
}

export default function HolographicResolver() {
  const router = useRouter();
  const [domains, setDomains] = useState<DomainItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        const list: DomainItem[] = data.domains || data || [];
        setDomains(list);

        // Auto-redirect if exactly one domain
        if (list.length === 1) {
          router.replace(`/x/institutions/${list[0].id}/holo`);
        }
      })
      .catch(() => setError("Failed to load domains"));
  }, [router]);

  // Loading
  if (!domains && !error) {
    return (
      <div className="hp-loading">
        <Loader2 size={20} className="hf-spinner" />
        <span>Loading domains…</span>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="hp-error">
        <div className="hp-error-title">Could not load domains</div>
        <p className="hp-error-desc">{error}</p>
      </div>
    );
  }

  // No domains
  if (domains && domains.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Globe size={40} style={{ color: "var(--text-placeholder)", marginBottom: 16 }} />
        <h2 className="hf-page-title" style={{ marginBottom: 8 }}>No domains yet</h2>
        <p className="hf-text-sm hf-text-muted" style={{ marginBottom: 20 }}>
          Create a domain to get started with the holographic editor.
        </p>
        <Link href="/x/institutions/new/holo" className="hf-btn hf-btn-primary">
          <Plus size={14} />
          Create Domain
        </Link>
      </div>
    );
  }

  // Multiple domains — show picker (single domain auto-redirected above)
  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h1 className="hf-page-title" style={{ marginBottom: 4 }}>Holographic Editor</h1>
      <p className="hf-text-sm hf-text-muted" style={{ marginBottom: 24 }}>
        Choose a domain to configure.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {domains!.map((d) => (
          <Link
            key={d.id}
            href={`/x/institutions/${d.id}/holo`}
            className="hf-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 16,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <Globe size={18} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                {d.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {d.institution?.name || d.slug}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

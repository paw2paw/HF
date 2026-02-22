"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Eye } from "lucide-react";
import { useTerminology } from "@/contexts/TerminologyContext";

const STORAGE_KEY = "hf.educator-view.institutionId";

interface InstitutionOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * Shows an institution picker banner for non-EDUCATOR users viewing the educator portal.
 * Persists selection via sessionStorage + URL searchParams.
 */
export function AdminInstitutionBanner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { terms } = useTerminology();

  const role = session?.user?.role;
  const isEducator = role === "EDUCATOR";

  // Fetch institutions on mount
  useEffect(() => {
    setMounted(true);
    if (isEducator) return;

    fetch("/api/institutions")
      .then((res) => res.json())
      .then((data) => {
        if (data?.institutions) {
          setInstitutions(
            data.institutions.map((i: InstitutionOption) => ({
              id: i.id,
              name: i.name,
              slug: i.slug,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isEducator]);

  // Initialize selection from URL or sessionStorage
  useEffect(() => {
    if (isEducator) return;
    const urlId = searchParams.get("institutionId");
    if (urlId) {
      setSelectedId(urlId);
      sessionStorage.setItem(STORAGE_KEY, urlId);
    } else {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSelectedId(stored);
        const params = new URLSearchParams(searchParams.toString());
        params.set("institutionId", stored);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (institutionId: string) => {
      setSelectedId(institutionId || null);
      if (institutionId) {
        sessionStorage.setItem(STORAGE_KEY, institutionId);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      const params = new URLSearchParams(searchParams.toString());
      if (institutionId) {
        params.set("institutionId", institutionId);
      } else {
        params.delete("institutionId");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  if (isEducator || !mounted) return null;

  const selectedName = institutions.find((i) => i.id === selectedId)?.name;

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Eye
        size={14}
        style={{ color: "var(--accent-primary)", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
        }}
      >
        Viewing {terms.domain.toLowerCase()}:
      </span>
      {loading ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Loading...
        </span>
      ) : (
        <select
          value={selectedId ?? ""}
          onChange={(e) => handleSelect(e.target.value)}
          style={{
            padding: "6px 12px",
            fontSize: 14,
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            maxWidth: 320,
            flex: 1,
            cursor: "pointer",
          }}
        >
          <option value="">Select a {terms.domain.toLowerCase()}...</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>
      )}
      {selectedName && (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {selectedName}
        </span>
      )}
    </div>
  );
}

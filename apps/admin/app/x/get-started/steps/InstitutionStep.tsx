"use client";

/**
 * Step 1: Your Organisation
 *
 * Two modes:
 * A) Create new — name + type chips + optional website import
 * B) Select existing — institution picker (when user has 1+ institutions)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Check, Globe, Lightbulb, Building2 } from "lucide-react";
import { TypePicker } from "@/components/shared/TypePicker";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

interface ExistingInstitution {
  id: string;
  name: string;
  typeSlug: string;
  domainId: string;
}

interface UrlImportResult {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

function suggestTypeFromName(name: string): string | null {
  if (!name.trim()) return null;
  if (/school|primary|secondary|infant|junior|nursery|prep|sixth.?form/i.test(name)) return "school";
  if (/hospital|clinic|health|care|nhs|therapy|medical|dental/i.test(name)) return "healthcare";
  if (/charity|foundation|community|trust|wellbeing|centre|center|society|association/i.test(name)) return "community";
  if (/gym|fitness|sport|athletics|personal.train/i.test(name)) return "coaching";
  if (/training|learning|workshop|development/i.test(name)) return "training";
  if (/ltd|limited|consulting|solutions|group|agency|corp|company|plc/i.test(name)) return "corporate";
  return null;
}

export function InstitutionStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const [mode, setMode] = useState<"new" | "existing">(getData<string>("existingInstitutionId") ? "existing" : "new");
  const [existingInstitutions, setExistingInstitutions] = useState<ExistingInstitution[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // New institution fields
  const [name, setName] = useState(getData<string>("institutionName") ?? "");
  const [typeSlug, setTypeSlug] = useState<string | null>(getData<string>("typeSlug") ?? null);
  const [typeId, setTypeId] = useState<string | undefined>(getData<string>("typeId") ?? undefined);
  const [websiteUrl, setWebsiteUrl] = useState(getData<string>("websiteUrl") ?? "");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<UrlImportResult | null>(
    getData<UrlImportResult>("urlImportResult") ?? null,
  );
  const urlImportAttempted = useRef(!!urlImportResult);

  // Existing institution selection
  const [selectedExisting, setSelectedExisting] = useState<string | null>(
    getData<string>("existingInstitutionId") ?? null,
  );

  // Load existing institutions
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/institutions");
        const data = await res.json();
        if (data.ok && data.institutions?.length > 0) {
          setExistingInstitutions(
            data.institutions.map((i: any) => ({
              id: i.id,
              name: i.name,
              typeSlug: i.type?.slug || "school",
              domainId: i.domains?.[0]?.id || "",
            })),
          );
          // If user has no institutions, default to "new" mode
          if (data.institutions.length === 0) setMode("new");
        } else {
          setMode("new");
        }
      } catch {
        setMode("new");
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, []);

  const suggestedType = !typeSlug ? suggestTypeFromName(name) : null;
  const effectiveType = typeSlug ?? suggestedType;

  const canContinueNew = name.trim().length > 0 && !!effectiveType;
  const canContinueExisting = !!selectedExisting;

  const handleUrlImport = useCallback(
    async (url: string) => {
      if (!url.trim() || urlImportAttempted.current) return;
      urlImportAttempted.current = true;
      setUrlImporting(true);
      try {
        const res = await fetch("/api/institutions/url-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        const data = await res.json();
        if (data.ok && data.meta) {
          setUrlImportResult(data.meta);
          setData("urlImportResult", data.meta);
          if (!name.trim() && data.meta.name) setName(data.meta.name);
          if (data.meta.logoUrl) setData("logoUrl", data.meta.logoUrl);
          if (data.meta.primaryColor) setData("primaryColor", data.meta.primaryColor);
          if (data.meta.secondaryColor) setData("secondaryColor", data.meta.secondaryColor);
        }
      } catch {
        // Silent — manual entry fallback
      } finally {
        setUrlImporting(false);
      }
    },
    [name, setData],
  );

  const handleNext = () => {
    if (mode === "existing" && selectedExisting) {
      const inst = existingInstitutions.find((i) => i.id === selectedExisting);
      if (inst) {
        setData("existingInstitutionId", inst.id);
        setData("existingInstitutionName", inst.name);
        setData("existingDomainId", inst.domainId);
        setData("typeSlug", inst.typeSlug);
        // Clear new-institution fields
        setData("institutionName", undefined);
      }
    } else {
      setData("institutionName", name.trim());
      setData("typeSlug", effectiveType);
      if (typeId) setData("typeId", typeId);
      setData("websiteUrl", websiteUrl);
      // Clear existing-institution fields
      setData("existingInstitutionId", undefined);
      setData("existingInstitutionName", undefined);
      setData("existingDomainId", undefined);
    }
    onNext();
  };

  if (loadingExisting) {
    return (
      <div className="hf-wizard-page">
        <div className="hf-wizard-step">
          <div className="hf-flex hf-items-center hf-gap-sm hf-text-muted">
            <Loader2 size={16} className="hf-spinner" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        <div className="hf-mb-lg">
          <h1 className="hf-page-title hf-mb-xs">Your organisation</h1>
          <p className="hf-page-subtitle">Where will the AI tutor be used?</p>
        </div>

        {/* Mode toggle — only show if user has existing institutions */}
        {existingInstitutions.length > 0 && (
          <div className="hf-mb-lg">
            <div className="hf-flex" style={{ gap: 6 }}>
              <button
                type="button"
                className={"hf-chip" + (mode === "existing" ? " hf-chip-selected" : "")}
                onClick={() => setMode("existing")}
              >
                Select existing
              </button>
              <button
                type="button"
                className={"hf-chip" + (mode === "new" ? " hf-chip-selected" : "")}
                onClick={() => setMode("new")}
              >
                Create new
              </button>
            </div>
          </div>
        )}

        {mode === "existing" ? (
          <div className="hf-mb-lg">
            <div className="hf-label" style={{ marginBottom: 8 }}>Select institution</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {existingInstitutions.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  className={"hf-list-row" + (selectedExisting === inst.id ? " hf-list-row-selected" : "")}
                  onClick={() => setSelectedExisting(inst.id)}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    border: selectedExisting === inst.id
                      ? "2px solid var(--accent-primary)"
                      : "1px solid var(--border-default)",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: selectedExisting === inst.id
                      ? "var(--accent-primary-light, rgba(37, 99, 235, 0.05))"
                      : "var(--surface-primary)",
                  }}
                >
                  <div className="hf-flex hf-items-center hf-gap-sm">
                    <Building2 size={16} className="hf-text-muted" />
                    <span style={{ fontWeight: 500 }}>{inst.name}</span>
                    <span className="hf-text-sm hf-text-muted" style={{ marginLeft: "auto" }}>
                      {inst.typeSlug}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="hf-mb-lg">
              <FieldHint
                label="What type of organisation?"
                hint={WIZARD_HINTS["institution.type"]}
                labelClass="hf-label"
              />
              <TypePicker
                value={typeSlug}
                suggestedValue={suggestedType}
                onChange={(slug, id) => {
                  setTypeSlug(slug);
                  setTypeId(id);
                }}
              />
            </div>

            <div className="hf-mb-lg">
              <FieldHint
                label="Organisation name"
                hint={WIZARD_HINTS["institution.name"]}
                labelClass="hf-label"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Oakwood Primary School"
                className="hf-input"
              />
            </div>

            <div className="hf-mb-lg">
              <FieldHint
                label="Website (optional)"
                hint={WIZARD_HINTS["institution.website"]}
                labelClass="hf-label"
              />
              <div className="hf-flex hf-items-center hf-gap-sm">
                <Globe size={16} className="hf-text-muted hf-flex-shrink-0" />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onBlur={() => {
                    if (websiteUrl.trim()) handleUrlImport(websiteUrl);
                  }}
                  placeholder="https://www.school.co.uk"
                  className="hf-input hf-flex-1"
                />
              </div>
              {urlImporting && (
                <div className="hf-ai-loading-row hf-mt-xs">
                  <Loader2 size={14} className="hf-spinner" />
                  <span className="hf-text-sm">Importing from website...</span>
                </div>
              )}
              {urlImportResult && !urlImporting && (
                <div className="hf-banner hf-banner-success hf-mt-xs">
                  <Check size={14} />
                  Imported{urlImportResult.name ? `: ${urlImportResult.name}` : ""}
                  {urlImportResult.primaryColor ? " · colours detected" : ""}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <StepFooter
        onBack={onPrev}
        onNext={handleNext}
        nextLabel="Continue"
        nextDisabled={mode === "existing" ? !canContinueExisting : !canContinueNew}
      />
    </div>
  );
}

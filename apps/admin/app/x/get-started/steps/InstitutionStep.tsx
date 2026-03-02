"use client";

/**
 * Step 1: Your Organisation — Conversational Typeahead
 *
 * Single text input: type to filter existing institutions or create new.
 * No mode toggle — the system infers intent from the user's input.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Check, Globe, X } from "lucide-react";
import { TypePicker } from "@/components/shared/TypePicker";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

interface ExistingInstitution {
  id: string;
  name: string;
  typeSlug: string | null;
  domainId: string | null;
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
  // ── Existing institutions ──
  const [institutions, setInstitutions] = useState<ExistingInstitution[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // ── Core state ──
  const initialSelected = getData<string>("existingInstitutionId");
  const initialName = getData<string>("institutionName") || getData<string>("existingInstitutionName") || "";

  const [query, setQuery] = useState(initialName);
  const [selectedInst, setSelectedInst] = useState<ExistingInstitution | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // ── New institution fields ──
  const [typeSlug, setTypeSlug] = useState<string | null>(getData<string>("typeSlug") ?? null);
  const [typeId, setTypeId] = useState<string | undefined>(getData<string>("typeId") ?? undefined);
  const [websiteUrl, setWebsiteUrl] = useState(getData<string>("websiteUrl") ?? "");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<UrlImportResult | null>(
    getData<UrlImportResult>("urlImportResult") ?? null,
  );
  const urlImportAttempted = useRef(!!urlImportResult);

  // ── Refs ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load existing institutions ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/institutions");
        const data = await res.json();
        if (data.ok && data.institutions?.length > 0) {
          const mapped: ExistingInstitution[] = data.institutions.map((i: any) => ({
            id: i.id,
            name: i.name,
            typeSlug: i.typeSlug || null,
            domainId: i.domainId || null,
          }));
          setInstitutions(mapped);

          // Restore selection if returning to this step
          if (initialSelected) {
            const match = mapped.find((i) => i.id === initialSelected);
            if (match) {
              setSelectedInst(match);
              setQuery(match.name);
              setIsLocked(true);
            }
          }
        }
      } catch {
        // Silent — just means no existing institutions to show
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const isCreatingNew = !isLocked && query.trim().length > 0;
  const suggestedType = !typeSlug ? suggestTypeFromName(query) : null;
  const effectiveType = typeSlug ?? suggestedType;

  const filteredInstitutions = useMemo(() => {
    if (!query.trim() || isLocked) return [];
    const q = query.toLowerCase();
    return institutions.filter((i) => i.name.toLowerCase().includes(q));
  }, [query, institutions, isLocked]);

  const hasExactMatch = filteredInstitutions.some(
    (i) => i.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreateAction = query.trim().length > 0 && !hasExactMatch && !isLocked;

  // Total dropdown items (for keyboard nav bounds)
  const dropdownItemCount = filteredInstitutions.length + (showCreateAction ? 1 : 0);
  const isDropdownVisible = showDropdown && !isLocked && dropdownItemCount > 0;

  // ── Handlers ──
  const handleSelectInstitution = useCallback((inst: ExistingInstitution) => {
    setSelectedInst(inst);
    setQuery(inst.name);
    setIsLocked(true);
    setShowDropdown(false);
    setHighlightIndex(-1);
  }, []);

  const handleCreateNew = useCallback(() => {
    setShowDropdown(false);
    setHighlightIndex(-1);
    // Just close dropdown — "creating new" is implicit when no selection
  }, []);

  const handleClear = useCallback(() => {
    setSelectedInst(null);
    setIsLocked(false);
    setQuery("");
    setShowDropdown(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    setShowDropdown(true);
    setHighlightIndex(-1);
    // Clear any prior selection data when user changes the name
    if (selectedInst) {
      setSelectedInst(null);
      setIsLocked(false);
    }
  }, [selectedInst]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isDropdownVisible) {
        if (e.key === "ArrowDown" && dropdownItemCount > 0) {
          setShowDropdown(true);
          setHighlightIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, dropdownItemCount - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filteredInstitutions.length) {
            handleSelectInstitution(filteredInstitutions[highlightIndex]);
          } else if (highlightIndex === filteredInstitutions.length && showCreateAction) {
            handleCreateNew();
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          setHighlightIndex(-1);
          break;
      }
    },
    [isDropdownVisible, dropdownItemCount, highlightIndex, filteredInstitutions, showCreateAction, handleSelectInstitution, handleCreateNew],
  );

  // ── Click outside to close ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Scroll highlighted into view ──
  useEffect(() => {
    if (isDropdownVisible && dropdownRef.current && highlightIndex >= 0) {
      const el = dropdownRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, isDropdownVisible]);

  // ── URL import ──
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
          if (!query.trim() && data.meta.name) setQuery(data.meta.name);
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
    [query, setData],
  );

  // ── Validation ──
  const canContinue = isLocked
    ? true // Existing selection is always valid
    : query.trim().length > 0 && !!effectiveType;

  // ── Submit ──
  const handleNext = () => {
    if (selectedInst && isLocked) {
      setData("existingInstitutionId", selectedInst.id);
      setData("existingInstitutionName", selectedInst.name);
      setData("existingDomainId", selectedInst.domainId || "");
      setData("typeSlug", selectedInst.typeSlug);
      setData("institutionName", undefined);
    } else {
      setData("institutionName", query.trim());
      setData("typeSlug", effectiveType);
      if (typeId) setData("typeId", typeId);
      setData("websiteUrl", websiteUrl);
      setData("existingInstitutionId", undefined);
      setData("existingInstitutionName", undefined);
      setData("existingDomainId", undefined);
    }
    onNext();
  };

  // ── Loading state ──
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
          <FieldHint
            label="What's your school or organisation called?"
            hint={WIZARD_HINTS["institution.name"]}
            labelClass="hf-page-title hf-mb-xs"
          />
        </div>

        {/* ── Typeahead input ── */}
        <div className="hf-mb-lg">
          <div className="gs-typeahead-wrap" ref={wrapRef}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              readOnly={isLocked}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (!isLocked && query.trim()) setShowDropdown(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Just start typing..."
              className={`hf-input${isLocked ? " gs-typeahead-locked" : ""}`}
            />
            {isLocked && (
              <button
                type="button"
                className="gs-typeahead-clear"
                onClick={handleClear}
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            )}

            {/* ── Dropdown ── */}
            {isDropdownVisible && (
              <div className="gs-typeahead-dropdown" ref={dropdownRef}>
                {filteredInstitutions.map((inst, index) => (
                  <div
                    key={inst.id}
                    data-index={index}
                    data-highlighted={highlightIndex === index || undefined}
                    className="gs-typeahead-row"
                    onClick={() => handleSelectInstitution(inst)}
                    onMouseEnter={() => setHighlightIndex(index)}
                  >
                    <span className="gs-typeahead-row-name">{inst.name}</span>
                    {inst.typeSlug && (
                      <span className="gs-typeahead-row-meta">{inst.typeSlug}</span>
                    )}
                  </div>
                ))}
                {showCreateAction && (
                  <div
                    data-index={filteredInstitutions.length}
                    data-highlighted={highlightIndex === filteredInstitutions.length || undefined}
                    className="gs-typeahead-row gs-typeahead-create"
                    onClick={handleCreateNew}
                    onMouseEnter={() => setHighlightIndex(filteredInstitutions.length)}
                  >
                    + Create &ldquo;{query.trim()}&rdquo; as new organisation
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Locked badge (existing selected) ── */}
          {isLocked && selectedInst && (
            <div className="gs-locked-badge">
              <Check size={14} />
              <span>Using existing</span>
              {selectedInst.typeSlug && (
                <>
                  <span className="gs-locked-badge-sep" />
                  <span>{selectedInst.typeSlug}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── New institution fields (only when creating new) ── */}
        {isCreatingNew && !isLocked && (
          <>
            <div className="hf-mb-lg">
              <FieldHint
                label="What kind of place is this?"
                hint={WIZARD_HINTS["institution.type"]}
                labelClass="hf-page-subtitle"
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
                label="Got a website? We can grab your logo and colours."
                hint={WIZARD_HINTS["institution.website"]}
                labelClass="hf-page-subtitle"
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
        nextDisabled={!canContinue}
      />
    </div>
  );
}

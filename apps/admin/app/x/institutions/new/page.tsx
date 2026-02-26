"use client";

/**
 * InstitutionWizard — single-page progressive accordion for institution setup.
 *
 * 5 sections: identity → branding → welcome → terminology → launch
 *
 * Design principles:
 * - SectionStatus state machine: locked / active / done (same as TeachWizard)
 * - CASCADE map drives which sections re-lock when a prior section is edited
 * - TypePicker drives terminology defaults + archetype resolution
 * - Live branding preview via applyBrandingToDOM()
 * - Both EDUCATOR (full) and SUPERADMIN (quick-skip) paths supported naturally
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Globe } from "lucide-react";
import WizardSection, { type SectionStatus } from "@/components/shared/WizardSection";
import WizardProgress from "@/components/shared/WizardProgress";
import { TypePicker } from "@/components/shared/TypePicker";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { applyBrandingToDOM, clearBrandingFromDOM } from "@/lib/branding";
import { useBranding } from "@/contexts/BrandingContext";
import Link from "next/link";
import "./institution-wizard.css";

// ── Constants ───────────────────────────────────────

const SECTION_ORDER = [
  "identity",
  "branding",
  "welcome",
  "terminology",
  "launch",
] as const;

type SectionId = (typeof SECTION_ORDER)[number];

const CASCADE: Record<SectionId, SectionId[]> = {
  identity: ["branding", "welcome", "terminology", "launch"],
  branding: [],
  welcome: [],
  terminology: [],
  launch: [],
};

const SECTION_TITLES: Record<SectionId, string> = {
  identity: "Tell us about your institution",
  branding: "Make it yours",
  welcome: "Welcome message",
  terminology: "Terminology",
  launch: "Launch",
};

// ── Helpers ─────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TERM_PREVIEW_KEYS = [
  { key: "domain", label: "Institution" },
  { key: "playbook", label: "Course" },
  { key: "caller", label: "Learner" },
  { key: "instructor", label: "Instructor" },
  { key: "session", label: "Session" },
] as const;

// ── URL Import result type ──────────────────────────

interface UrlImportResult {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  description?: string;
}

// ── Component ───────────────────────────────────────

export default function InstitutionWizard() {
  const router = useRouter();
  const { refreshBranding } = useBranding();

  // ── Section status ─────────────────────────────────

  const [sectionStatus, setSectionStatus] = useState<Record<SectionId, SectionStatus>>({
    identity: "active",
    branding: "locked",
    welcome: "locked",
    terminology: "locked",
    launch: "locked",
  });

  const completeSection = useCallback((id: SectionId) => {
    setSectionStatus((prev) => {
      const next = { ...prev, [id]: "done" as SectionStatus };
      const idx = SECTION_ORDER.indexOf(id);
      // Unlock the next locked section
      for (let i = idx + 1; i < SECTION_ORDER.length; i++) {
        const nextId = SECTION_ORDER[i];
        if (prev[nextId] === "locked") {
          next[nextId] = "active";
          break;
        }
      }
      return next;
    });
  }, []);

  const editSection = useCallback((id: SectionId) => {
    setSectionStatus((prev) => {
      const next = { ...prev, [id]: "active" as SectionStatus };
      for (const dep of CASCADE[id]) {
        next[dep] = "locked";
      }
      return next;
    });
  }, []);

  // When identity completes, unlock ALL downstream (not just next) since they're independent
  const completeIdentity = useCallback(() => {
    setSectionStatus({
      identity: "done",
      branding: "active",
      welcome: "active",
      terminology: "active",
      launch: "active",
    });
  }, []);

  const activeStep =
    SECTION_ORDER.findIndex((s) => sectionStatus[s] === "active") + 1;

  // ── Section 1 — Identity ───────────────────────────

  const [name, setName] = useState("");
  const [selectedTypeSlug, setSelectedTypeSlug] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<UrlImportResult | null>(null);
  const urlImportAttempted = useRef(false);

  const slug = toSlug(name);
  const canContinueIdentity = name.trim().length > 0 && selectedTypeSlug !== null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleUrlImport = useCallback(async (url: string) => {
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
        // Pre-fill name if empty
        if (!name.trim() && data.meta.name) {
          setName(data.meta.name);
        }
        // Pre-fill branding
        if (data.meta.logoUrl) setLogoUrl(data.meta.logoUrl);
        if (data.meta.primaryColor) setPrimaryColor(data.meta.primaryColor);
        if (data.meta.secondaryColor) setSecondaryColor(data.meta.secondaryColor);
      }
    } catch {
      // Silently fail — manual entry fallback
    } finally {
      setUrlImporting(false);
    }
  }, [name]);

  const handleIdentityContinue = useCallback(() => {
    completeIdentity();
  }, [completeIdentity]);

  // ── Section 2 — Branding ───────────────────────────

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");

  // Live branding preview — apply to DOM when colors change in branding section
  useEffect(() => {
    if (sectionStatus.branding !== "active" && sectionStatus.branding !== "done") return;
    if (!primaryColor && !secondaryColor) return;

    applyBrandingToDOM({
      name: name || "Preview",
      typeName: null,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      welcomeMessage: null,
    });

    return () => {
      if (primaryColor || secondaryColor) {
        clearBrandingFromDOM();
      }
    };
  }, [primaryColor, secondaryColor, sectionStatus.branding, name, logoUrl]);

  const handleBrandingContinue = useCallback(() => {
    completeSection("branding");
  }, [completeSection]);

  // ── Section 3 — Welcome ────────────────────────────

  const [welcomeMessage, setWelcomeMessage] = useState("");

  const handleWelcomeContinue = useCallback(() => {
    completeSection("welcome");
  }, [completeSection]);

  // ── Section 4 — Terminology ────────────────────────

  const [terminology, setTerminology] = useState<Record<string, string> | null>(null);
  const terminologyFetched = useRef(false);

  // Fetch terminology from type when identity is completed
  useEffect(() => {
    if (!selectedTypeSlug || terminologyFetched.current) return;
    if (sectionStatus.identity !== "done") return;
    terminologyFetched.current = true;

    fetch("/api/admin/institution-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.types) {
          const match = data.types.find((t: { slug: string }) => t.slug === selectedTypeSlug);
          if (match?.terminology) {
            setTerminology(match.terminology);
          }
        }
      })
      .catch(() => {});
  }, [selectedTypeSlug, sectionStatus.identity]);

  const handleTerminologyContinue = useCallback(() => {
    completeSection("terminology");
  }, [completeSection]);

  // ── Section 5 — Launch ─────────────────────────────

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ institutionId: string; domainId: string } | null>(null);

  const handleLaunch = useCallback(async () => {
    setCreating(true);
    setCreateError(null);

    try {
      // Step 1: Create institution
      const instBody: Record<string, unknown> = {
        name: name.trim(),
        slug,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        welcomeMessage: welcomeMessage || null,
      };
      if (selectedTypeId) instBody.typeId = selectedTypeId;
      else if (selectedTypeSlug) instBody.typeSlug = selectedTypeSlug;

      const instRes = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instBody),
      });
      const instData = await instRes.json();
      if (!instData.ok) {
        setCreateError(instData.error || "Failed to create institution");
        setCreating(false);
        return;
      }

      // Step 2: Create domain linked to institution
      const domRes = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          institutionId: instData.institution.id,
        }),
      });
      const domData = await domRes.json();
      if (!domData.ok) {
        setCreateError(domData.error || "Failed to create domain");
        setCreating(false);
        return;
      }

      // Step 3: Scaffold domain (await to ensure it completes)
      await fetch(`/api/domains/${domData.domain.id}/scaffold`, { method: "POST" });

      // Step 4: Link user to institution
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeInstitutionId: instData.institution.id }),
      });

      // Step 5: Refresh branding context so sidebar updates
      refreshBranding();

      setCreated({
        institutionId: instData.institution.id,
        domainId: domData.domain.id,
      });
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [name, slug, logoUrl, primaryColor, secondaryColor, welcomeMessage, selectedTypeId, selectedTypeSlug, refreshBranding]);

  // Clean up branding on unmount
  useEffect(() => {
    return () => {
      clearBrandingFromDOM();
    };
  }, []);

  // Reset terminology fetch when identity is re-edited
  useEffect(() => {
    if (sectionStatus.identity === "active") {
      terminologyFetched.current = false;
      urlImportAttempted.current = false;
      setTerminology(null);
      setUrlImportResult(null);
    }
  }, [sectionStatus.identity]);

  // ── Render ─────────────────────────────────────────

  return (
    <div className="iw-page">
      <button
        onClick={() => router.push("/x")}
        className="iw-back-link"
        type="button"
      >
        &larr; Back to Dashboard
      </button>
      <h1 className="hf-page-title">Set Up Institution</h1>

      <WizardProgress
        current={activeStep || SECTION_ORDER.length}
        total={SECTION_ORDER.length}
        stepName={activeStep ? SECTION_TITLES[SECTION_ORDER[activeStep - 1]] : "Done"}
      />

      <div className="iw-sections">
        {/* ── Section 1: Identity ──────────────────── */}
        <WizardSection
          id="identity"
          stepNumber={1}
          status={sectionStatus.identity}
          title={SECTION_TITLES.identity}
          hint="Name, type, and optional website for auto-import."
          summaryLabel="Institution"
          summary={`${name}${selectedTypeSlug ? ` · ${selectedTypeSlug}` : ""}`}
          onEdit={() => editSection("identity")}
        >
          <div className="iw-name-row">
            {/* Type picker */}
            <TypePicker
              value={selectedTypeSlug}
              onChange={(typeSlug, typeId) => {
                setSelectedTypeSlug(typeSlug);
                setSelectedTypeId(typeId);
              }}
            />

            {/* Name */}
            <div>
              <FieldHint label="Name" hint={WIZARD_HINTS["institution.name"]} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Oakwood Primary School"
                className="hf-input"
              />
              {slug && <p className="iw-slug-preview">{slug}</p>}
            </div>

            {/* Website URL */}
            <div className="iw-url-row">
              <FieldHint label="Website (optional)" hint={WIZARD_HINTS["institution.website"]} />
              <div className="iw-color-row">
                <Globe size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onBlur={() => {
                    if (websiteUrl.trim()) handleUrlImport(websiteUrl);
                  }}
                  placeholder="https://www.school.co.uk"
                  className="hf-input"
                  style={{ flex: 1 }}
                />
              </div>
              {urlImporting && (
                <div className="iw-url-importing">
                  <Loader2 size={14} className="hf-spinner" />
                  Importing from website...
                </div>
              )}
              {urlImportResult && !urlImporting && (
                <div className="iw-url-result">
                  <Check size={14} />
                  Imported{urlImportResult.name ? `: ${urlImportResult.name}` : ""}{urlImportResult.primaryColor ? ` · colours detected` : ""}
                </div>
              )}
            </div>

            {/* Continue */}
            <div className="ws-continue-row">
              <button
                className={`hf-btn hf-btn-primary${canContinueIdentity ? "" : " hf-btn-disabled"}`}
                disabled={!canContinueIdentity}
                onClick={handleIdentityContinue}
                type="button"
              >
                Continue
              </button>
            </div>
          </div>
        </WizardSection>

        {/* ── Section 2: Branding ──────────────────── */}
        <WizardSection
          id="branding"
          stepNumber={2}
          status={sectionStatus.branding}
          title={SECTION_TITLES.branding}
          hint="Logo and brand colours — applied across the entire platform."
          summaryLabel="Branding"
          summary={
            primaryColor ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="iw-launch-color-dot" style={{ width: 14, height: 14, background: primaryColor, display: "inline-block" }} />
                Custom branding
              </span>
            ) : "Default"
          }
          onEdit={() => editSection("branding")}
        >
          <div className="iw-branding-grid">
            {/* Logo */}
            <div>
              <FieldHint label="Logo URL" hint={WIZARD_HINTS["institution.logo"]} />
              <div className="iw-logo-preview">
                <div className="iw-logo-circle">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" />
                  ) : (
                    name.charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="hf-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* Primary color */}
            <div>
              <FieldHint label="Primary Colour" hint={WIZARD_HINTS["institution.primaryColor"]} />
              <div className="iw-color-row">
                <input
                  type="color"
                  value={primaryColor || "#3b82f6"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="iw-color-swatch"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="hf-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* Secondary color */}
            <div>
              <label className="hf-label">Secondary Colour</label>
              <div className="iw-color-row">
                <input
                  type="color"
                  value={secondaryColor || "#6366f1"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="iw-color-swatch"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#6366f1"
                  className="hf-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* Live preview */}
            {(primaryColor || name) && (
              <div className="iw-branding-preview">
                <div className="iw-branding-preview-label">Live Preview</div>
                <div className="iw-branding-preview-bar">
                  <div
                    className="iw-branding-preview-dot"
                    style={{ background: primaryColor || "var(--accent-primary)" }}
                  />
                  <span className="iw-branding-preview-name">{name || "Institution"}</span>
                  <span
                    className="iw-branding-preview-btn"
                    style={{ background: primaryColor || "var(--accent-primary)" }}
                  >
                    Button
                  </span>
                </div>
              </div>
            )}

            {/* Continue / Skip */}
            <div className="ws-continue-row" style={{ gap: 8 }}>
              <button
                className="hf-btn hf-btn-secondary"
                onClick={handleBrandingContinue}
                type="button"
              >
                Skip
              </button>
              <button
                className="hf-btn hf-btn-primary"
                onClick={handleBrandingContinue}
                type="button"
              >
                Continue
              </button>
            </div>
          </div>
        </WizardSection>

        {/* ── Section 3: Welcome ───────────────────── */}
        <WizardSection
          id="welcome"
          stepNumber={3}
          status={sectionStatus.welcome}
          title={SECTION_TITLES.welcome}
          hint="The first thing students see on their join page."
          aiEnhanced
          summaryLabel="Welcome"
          summary={welcomeMessage ? `${welcomeMessage.slice(0, 40)}${welcomeMessage.length > 40 ? "..." : ""}` : "Default"}
          onEdit={() => editSection("welcome")}
        >
          <div>
            <FieldHint label="Welcome Message" hint={WIZARD_HINTS["institution.welcome"]} />
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder={`Welcome to ${name || "our institution"}! Our AI tutors help every learner build confidence.`}
              rows={3}
              className="hf-input iw-welcome-textarea"
            />

            <div className="ws-continue-row" style={{ gap: 8 }}>
              <button
                className="hf-btn hf-btn-secondary"
                onClick={handleWelcomeContinue}
                type="button"
              >
                Skip
              </button>
              <button
                className="hf-btn hf-btn-primary"
                onClick={handleWelcomeContinue}
                type="button"
              >
                Continue
              </button>
            </div>
          </div>
        </WizardSection>

        {/* ── Section 4: Terminology ───────────────── */}
        <WizardSection
          id="terminology"
          stepNumber={4}
          status={sectionStatus.terminology}
          title={SECTION_TITLES.terminology}
          hint="How the platform labels concepts for your users."
          summaryLabel="Terminology"
          summary={selectedTypeSlug ? `${selectedTypeSlug} preset` : "Default"}
          onEdit={() => editSection("terminology")}
        >
          <div>
            <FieldHint label="Terminology" hint={WIZARD_HINTS["institution.terminology"]} />
            <p className="ws-hint" style={{ marginTop: 4 }}>
              Pre-filled from your institution type. You can customise these later in settings.
            </p>

            {terminology ? (
              <table className="iw-term-table">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Your Label</th>
                  </tr>
                </thead>
                <tbody>
                  {TERM_PREVIEW_KEYS.map(({ key, label }) => (
                    <tr key={key}>
                      <td className="iw-term-key">{label}</td>
                      <td>{(terminology as Record<string, string>)[key] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Default terminology will be used.
              </p>
            )}

            <div className="ws-continue-row" style={{ gap: 8 }}>
              <button
                className="hf-btn hf-btn-secondary"
                onClick={handleTerminologyContinue}
                type="button"
              >
                Skip
              </button>
              <button
                className="hf-btn hf-btn-primary"
                onClick={handleTerminologyContinue}
                type="button"
              >
                Continue
              </button>
            </div>
          </div>
        </WizardSection>

        {/* ── Section 5: Launch ────────────────────── */}
        <WizardSection
          id="launch"
          stepNumber={5}
          status={sectionStatus.launch}
          title={SECTION_TITLES.launch}
          summaryLabel="Status"
          summary={created ? "Created" : "Ready"}
        >
          {created ? (
            <div className="iw-success">
              <div className="iw-success-title">
                <Check size={18} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                Institution created
              </div>
              <div className="iw-launch-summary">
                <div className="iw-launch-row">
                  <span className="iw-launch-label">Name</span>
                  <span className="iw-launch-value">{name}</span>
                </div>
                {selectedTypeSlug && (
                  <div className="iw-launch-row">
                    <span className="iw-launch-label">Type</span>
                    <span className="iw-launch-value">{selectedTypeSlug}</span>
                  </div>
                )}
              </div>
              <div className="iw-success-actions">
                <Link
                  href={`/x/courses?action=setup&institutionId=${created.institutionId}`}
                  className="hf-btn hf-btn-primary"
                >
                  Create a Course
                </Link>
                <Link
                  href="/x"
                  className="hf-btn hf-btn-secondary"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {/* Pre-launch summary */}
              <div className="iw-launch-summary">
                <div className="iw-launch-row">
                  <span className="iw-launch-label">Name</span>
                  <span className="iw-launch-value">{name || "—"}</span>
                </div>
                <div className="iw-launch-row">
                  <span className="iw-launch-label">Type</span>
                  <span className="iw-launch-value">{selectedTypeSlug || "—"}</span>
                </div>
                {primaryColor && (
                  <div className="iw-launch-row">
                    <span className="iw-launch-label">Colours</span>
                    <div className="iw-launch-colors">
                      <span className="iw-launch-color-dot" style={{ background: primaryColor }} />
                      {secondaryColor && (
                        <span className="iw-launch-color-dot" style={{ background: secondaryColor }} />
                      )}
                    </div>
                  </div>
                )}
                {welcomeMessage && (
                  <div className="iw-launch-row">
                    <span className="iw-launch-label">Welcome</span>
                    <span className="iw-launch-value">{welcomeMessage.slice(0, 60)}{welcomeMessage.length > 60 ? "..." : ""}</span>
                  </div>
                )}
              </div>

              {createError && (
                <div className="hf-banner hf-banner-error" style={{ marginTop: 12 }}>
                  {createError}
                </div>
              )}

              {creating ? (
                <div className="iw-creating">
                  <Loader2 size={18} className="hf-spinner" />
                  Creating institution and scaffolding...
                </div>
              ) : (
                <div className="ws-continue-row iw-launch-btn">
                  <button
                    className="hf-btn hf-btn-primary"
                    onClick={handleLaunch}
                    disabled={!canContinueIdentity}
                    type="button"
                  >
                    Launch Institution
                  </button>
                </div>
              )}
            </div>
          )}
        </WizardSection>
      </div>
    </div>
  );
}

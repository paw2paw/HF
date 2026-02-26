"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, Check, Globe } from "lucide-react";
import { TypePicker } from "@/components/shared/TypePicker";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

interface UrlImportResult {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function IdentityStep({ getData, setData, onNext }: StepRenderProps) {
  const [name, setName] = useState(getData<string>("institutionName") ?? "");
  const [typeSlug, setTypeSlug] = useState<string | null>(getData<string>("typeSlug") ?? null);
  const [typeId, setTypeId] = useState<string | undefined>(getData<string>("typeId") ?? undefined);
  const [websiteUrl, setWebsiteUrl] = useState(getData<string>("websiteUrl") ?? "");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<UrlImportResult | null>(
    getData<UrlImportResult>("urlImportResult") ?? null,
  );
  const urlImportAttempted = useRef(!!urlImportResult);

  const slug = toSlug(name);
  const canContinue = name.trim().length > 0 && typeSlug !== null;

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
          // Pre-fill branding data bag so BrandingStep initialises from them
          if (data.meta.logoUrl) setData("logoUrl", data.meta.logoUrl);
          if (data.meta.primaryColor) setData("primaryColor", data.meta.primaryColor);
          if (data.meta.secondaryColor) setData("secondaryColor", data.meta.secondaryColor);
        }
      } catch {
        // Silently fail — manual entry fallback
      } finally {
        setUrlImporting(false);
      }
    },
    [name, setData],
  );

  const handleNext = () => {
    setData("institutionName", name.trim());
    setData("typeSlug", typeSlug);
    if (typeId) setData("typeId", typeId);
    setData("websiteUrl", websiteUrl);
    onNext();
  };

  return (
    <div className="iw-name-row">
      <div>
        <FieldHint label="Institution Type" hint={WIZARD_HINTS["institution.type"]} />
        <TypePicker
          value={typeSlug}
          onChange={(slug, id) => {
            setTypeSlug(slug);
            setTypeId(id);
          }}
        />
      </div>

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
            Imported{urlImportResult.name ? `: ${urlImportResult.name}` : ""}
            {urlImportResult.primaryColor ? ` · colours detected` : ""}
          </div>
        )}
      </div>

      <StepFooter onNext={handleNext} nextLabel="Continue" nextDisabled={!canContinue} />
    </div>
  );
}

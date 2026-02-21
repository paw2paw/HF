"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronRight,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Ticket,
  Save,
  RotateCcw,
  Eye,
  LayoutGrid,
  VenetianMask,
  Search,
  X,
  LogIn,
  PlayCircle,
  Settings2,
  ListChecks,
  Building2,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useMasquerade } from "@/contexts/MasqueradeContext";
import { useBranding } from "@/contexts/BrandingContext";
import { TourTrigger } from "@/src/components/shared/TourTrigger";
import { UserAvatar, ROLE_COLORS } from "./UserAvatar";
import { envSidebarColor, envLabel } from "./EnvironmentBanner";

interface LayoutOptions {
  isAdmin: boolean;
  hasCustomLayout: boolean;
  hiddenSections: { id: string; title: string }[];
  onSavePersonalDefault: () => Promise<unknown>;
  onSaveGlobalDefault: () => Promise<unknown>;
  onResetLayout: () => void;
  onShowSection: (id: string) => void;
}

interface MasqueradeOptions {
  isRealAdmin: boolean;
}

interface AccountPanelProps {
  onClose: () => void;
  onNavigate?: () => void;
  unreadCount?: number;
  layoutOptions?: LayoutOptions;
  masqueradeOptions?: MasqueradeOptions;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  EDUCATOR: "Educator",
  SUPER_TESTER: "Super Tester",
  TESTER: "Tester",
  DEMO: "Demo",
  VIEWER: "Viewer",
};

const PICKER_ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "var(--status-error-text)",
  ADMIN: "var(--badge-orange-text, #ea580c)",
  OPERATOR: "var(--accent-primary)",
  EDUCATOR: "var(--status-success-text)",
  SUPER_TESTER: "var(--accent-secondary, #8b5cf6)",
  TESTER: "var(--text-muted)",
  DEMO: "var(--text-muted)",
  VIEWER: "var(--text-muted)",
};

/* ── Reusable section heading ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pb-1.5 pt-6 text-[10px] font-semibold uppercase tracking-widest"
      style={{
        color: "var(--text-muted)",
        borderTop: "1px solid var(--border-subtle)",
        marginTop: "4px",
      }}
    >
      {children}
    </div>
  );
}

/* ── Institution badge in profile card ── */
function InstitutionBadge() {
  const { branding, loading } = useBranding();

  if (loading) return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
      {branding.primaryColor && (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: branding.primaryColor,
            flexShrink: 0,
          }}
        />
      )}
      {branding.logoUrl && (
        <img
          src={branding.logoUrl}
          alt=""
          style={{
            height: 14,
            width: "auto",
            maxWidth: 80,
            flexShrink: 0,
          }}
        />
      )}
      <span className="truncate">{branding.name}</span>
    </div>
  );
}

/* ── Reusable nav-link row ── */
function PanelLink({
  href,
  icon: Icon,
  label,
  onClick,
  badge,
  accent,
  pills,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  badge?: number;
  accent?: boolean;
  pills?: Array<{ label: string; count: number; color: string }>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
      style={{ color: accent ? "var(--accent-primary)" : "var(--text-secondary)" }}
    >
      <Icon
        className="h-[18px] w-[18px] flex-shrink-0"
        style={{ color: accent ? "var(--accent-primary)" : "var(--text-muted)" }}
      />
      <span className="flex-1">{label}</span>
      {pills && pills.length > 0 && (
        <span className="inline-flex items-center gap-1">
          {pills.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: `color-mix(in srgb, ${pill.color} 12%, transparent)`,
                color: pill.color,
              }}
              title={pill.label}
            >
              {pill.count}
            </span>
          ))}
        </span>
      )}
      {badge != null && badge > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white min-w-[20px] px-1.5 py-0.5"
          style={{ background: "var(--accent-primary)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

/* ── Reusable action button row ── */
function PanelButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent,
  muted,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:pointer-events-none"
      style={{ color: accent ? "var(--accent-primary)" : muted ? "var(--text-muted)" : "var(--text-secondary)" }}
    >
      <Icon
        className="h-[18px] w-[18px] flex-shrink-0"
        style={{ color: accent ? "var(--accent-primary)" : "var(--text-muted)" }}
      />
      {label}
    </button>
  );
}

/* ── Inline user picker for Step In ── */
interface PickerUser {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  role: string;
  assignedDomainId: string | null;
  assignedDomain: { id: string; name: string } | null;
}

/* ── Institution switcher (for ADMIN+) ── */
interface Institution {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

function InstitutionSwitcher() {
  const { data: session } = useSession();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [activeInstitutionId, setActiveInstitutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is ADMIN+
  const isAdmin = session?.user?.role && ["ADMIN", "SUPERADMIN"].includes(session.user.role);

  // Fetch institutions on mount
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    async function fetchInstitutions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/user/institutions");
        if (!res.ok) throw new Error("Failed to load institutions");
        const data = await res.json();
        if (!cancelled) {
          setInstitutions(data.institutions || []);
          // Set active to user's activeInstitutionId or institutionId
          const activeId = (session?.user as any)?.activeInstitutionId || (session?.user as any)?.institutionId;
          setActiveInstitutionId(activeId || null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInstitutions();
    return () => { cancelled = true; };
  }, [isAdmin, session]);

  const handleSwitch = async (institutionId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/user/active-institution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to switch institution");
      }
      setActiveInstitutionId(institutionId);
      // Reload to refresh session with new activeInstitutionId
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Only show if ADMIN+ and has 2+ institutions
  if (!isAdmin || institutions.length <= 1) return null;

  const activeInstitution = institutions.find((i) => i.id === activeInstitutionId);

  return (
    <div className="mx-3">
      {/* Current institution display */}
      {activeInstitution && (
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-1"
          style={{
            background: `color-mix(in srgb, var(--status-success-text) 8%, transparent)`,
            border: `1px solid color-mix(in srgb, var(--status-success-text) 15%, transparent)`,
          }}
        >
          <Building2
            className="h-4 w-4 flex-shrink-0"
            style={{ color: "var(--status-success-text)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate" style={{ color: "var(--status-success-text)" }}>
              {activeInstitution.name}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Active institution
            </div>
          </div>
        </div>
      )}

      {/* Switcher button */}
      {institutions.length > 1 && (
        <div className="space-y-1.5">
          {institutions.map((inst) => {
            const isActive = inst.id === activeInstitutionId;
            return (
              <button
                key={inst.id}
                onClick={() => !isActive && handleSwitch(inst.id)}
                disabled={isActive}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-default"
                style={{ color: "var(--text-primary)" }}
              >
                {/* Color swatch */}
                {inst.primaryColor && (
                  <div
                    className="h-3 w-3 rounded flex-shrink-0"
                    style={{ background: inst.primaryColor }}
                  />
                )}
                {/* Logo or fallback */}
                {inst.logoUrl ? (
                  <img src={inst.logoUrl} alt="" style={{ height: 14, width: "auto", maxWidth: 50, flexShrink: 0 }} />
                ) : (
                  <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center rounded" style={{ background: "var(--status-success-text)" }}>
                    <span className="text-[10px] font-bold text-white">{inst.name[0]}</span>
                  </div>
                )}
                {/* Name */}
                <span className="flex-1 truncate">{inst.name}</span>
                {/* Active indicator */}
                {isActive && (
                  <span className="text-[9px] font-bold rounded px-1.5 py-0.5 flex-shrink-0" style={{ background: "var(--status-success-text)", color: "var(--surface-primary)" }}>
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-2 px-3 py-2 text-[11px] rounded-lg" style={{ background: "var(--status-error-bg)", color: "var(--status-error-text)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function StepInSection() {
  const { startMasquerade, stopMasquerade, isMasquerading, masquerade } = useMasquerade();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/admin/masquerade/users${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch users when expanded
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => fetchUsers(search), 200);
    return () => clearTimeout(timer);
  }, [expanded, search, fetchUsers]);

  // Auto-focus search when expanded
  useEffect(() => {
    if (expanded) searchRef.current?.focus();
  }, [expanded]);

  const handleSelect = async (user: PickerUser) => {
    try {
      await startMasquerade(user.id);
      setExpanded(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleExit = async () => {
    try {
      await stopMasquerade();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-3">
      {/* Active masquerade indicator */}
      {isMasquerading && masquerade && (
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-1"
          style={{
            background: `color-mix(in srgb, var(--masquerade-color) 8%, transparent)`,
            border: `1px solid color-mix(in srgb, var(--masquerade-color) 15%, transparent)`,
          }}
        >
          <VenetianMask
            className="h-4 w-4 flex-shrink-0"
            style={{ color: "var(--masquerade-color)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate" style={{ color: "var(--masquerade-color)" }}>
              {masquerade.name || masquerade.email}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Stepped in as {masquerade.role}
            </div>
          </div>
          <button
            onClick={handleExit}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors"
            style={{
              color: "var(--masquerade-color)",
              background: `color-mix(in srgb, var(--masquerade-color) 12%, transparent)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--masquerade-color) 20%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--masquerade-color) 12%, transparent)`;
            }}
          >
            <X className="h-3 w-3" />
            Exit
          </button>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
        style={{ color: "var(--text-secondary)" }}
      >
        <LogIn
          className="h-[18px] w-[18px] flex-shrink-0"
          style={{ color: isMasquerading ? "var(--masquerade-color)" : "var(--text-muted)" }}
        />
        <span className="flex-1 text-left">
          {isMasquerading ? "Switch User" : "Step In As..."}
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform"
          style={{
            color: "var(--text-muted)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Expandable user picker */}
      {expanded && (
        <div
          className="mt-1 rounded-lg overflow-hidden"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-secondary)",
          }}
        >
          {/* Search */}
          <div className="p-2 relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md py-1.5 pl-7 pr-2 text-[12px] outline-none"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--surface-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* User list */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {loading && (
              <div className="py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                Loading...
              </div>
            )}
            {error && (
              <div className="py-4 text-center text-[12px]" style={{ color: "var(--status-error-text)" }}>
                {error}
              </div>
            )}
            {!loading && !error && users.length === 0 && (
              <div className="py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                No users found
              </div>
            )}
            {!loading &&
              !error &&
              users.map((user) => {
                const isCurrentMasquerade = masquerade?.userId === user.id;
                const label = user.displayName || user.name || user.email;
                const roleColor = PICKER_ROLE_COLORS[user.role] || "var(--text-muted)";
                return (
                  <button
                    key={user.id}
                    onClick={() => !isCurrentMasquerade && handleSelect(user)}
                    disabled={isCurrentMasquerade}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-default"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: roleColor }}
                    >
                      {(label[0] || "?").toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                        {user.email}
                      </div>
                    </div>
                    {/* Role badge */}
                    <span
                      className="text-[9px] font-semibold rounded px-1.5 py-0.5 flex-shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${roleColor} 12%, transparent)`,
                        color: roleColor,
                      }}
                    >
                      {user.role}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountPanel({ onClose, onNavigate, unreadCount = 0, layoutOptions, masqueradeOptions }: AccountPanelProps) {
  const { data: session } = useSession();
  const { preference, setPreference } = useTheme();
  const { preference: viewPref, setPreference: setViewPref } = useViewMode();
  const user = session?.user;
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [taskCounts, setTaskCounts] = useState<{ processing: number; completedRecent: number }>({ processing: 0, completedRecent: 0 });

  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        const res = await fetch("/api/tasks/counts");
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.ok) setTaskCounts(data.counts);
        }
      } catch { /* ignore */ }
    }
    loadCounts();
    const interval = setInterval(loadCounts, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!user) return null;

  const displayLabel = (user as any).displayName || user.name || user.email || "User";
  const role = user.role || "VIEWER";
  const roleColor = ROLE_COLORS[role] || "var(--text-muted)";

  const handleNavigate = () => {
    onClose();
    onNavigate?.();
  };

  const handleSavePersonal = async () => {
    if (!layoutOptions) return;
    setSavingPersonal(true);
    await layoutOptions.onSavePersonalDefault();
    setSavingPersonal(false);
  };

  const handleSaveGlobal = async () => {
    if (!layoutOptions) return;
    setSavingGlobal(true);
    await layoutOptions.onSaveGlobalDefault();
    setSavingGlobal(false);
  };

  return (
    <div
      className="flex h-full flex-col overflow-y-auto"
      style={{ color: "var(--text-primary)" }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Settings
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover-bg)]"
          aria-label="Close settings"
        >
          <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* ─── Profile card ─── */}
      <div
        className="mx-3 mt-1 mb-2 flex flex-col items-center gap-3 rounded-xl px-5 py-5"
        style={{
          background: "var(--surface-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <UserAvatar
          name={displayLabel}
          role={role}
          userId={user.id}
          size={56}
        />
        <div className="text-center">
          <div className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {displayLabel}
          </div>
          {user.email && (
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {user.email}
            </div>
          )}
        </div>
        <span
          className="inline-block rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wide"
          style={{
            background: `color-mix(in srgb, ${roleColor} 12%, transparent)`,
            color: roleColor,
            border: `1px solid color-mix(in srgb, ${roleColor} 20%, transparent)`,
          }}
        >
          {ROLE_LABELS[role] || role}
        </span>

        {/* Institution badge */}
        <InstitutionBadge />
      </div>

      {/* ─── Notifications ─── */}
      <SectionLabel>Notifications</SectionLabel>
      <div className="mx-1 flex flex-col">
        <PanelLink href="/x/tickets" icon={Ticket} label="Messaging" onClick={handleNavigate} />
        <PanelLink
          href="/x/tasks"
          icon={ListChecks}
          label="Tasks"
          onClick={handleNavigate}
          pills={[
            ...(taskCounts.processing > 0 ? [{ label: "Processing", count: taskCounts.processing, color: "var(--accent-primary)" }] : []),
            ...(taskCounts.completedRecent > 0 ? [{ label: "Done (24h)", count: taskCounts.completedRecent, color: "var(--status-success-text)" }] : []),
          ]}
        />
      </div>

      {/* ─── Account ─── */}
      <SectionLabel>Account</SectionLabel>
      <div className="mx-1 flex flex-col">
        <PanelLink href="/x/account" icon={User} label="My Account" onClick={handleNavigate} />
        <PanelLink href="/x/demos" icon={PlayCircle} label="Demos" onClick={handleNavigate} />
      </div>

      {/* ─── Organization — institution switcher for ADMIN+ with 2+ institutions ─── */}
      <InstitutionSwitcher />

      {/* ─── Step In (masquerade) — admin only ─── */}
      {masqueradeOptions?.isRealAdmin && (
        <>
          <SectionLabel>Impersonate</SectionLabel>
          <StepInSection />
        </>
      )}

      {/* ─── Appearance ─── */}
      <SectionLabel>Appearance</SectionLabel>
      <div className="mx-3 flex gap-1.5">
        {([
          { value: "light" as const, icon: Sun, label: "Light" },
          { value: "dark" as const, icon: Moon, label: "Dark" },
          { value: "system" as const, icon: Monitor, label: "Auto" },
        ]).map(({ value, icon: Icon, label }) => {
          const isActive = preference === value;
          return (
            <button
              key={value}
              onClick={() => setPreference(value)}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 text-[10px] font-semibold tracking-wide transition-all"
              style={{
                background: isActive ? "var(--surface-selected)" : "transparent",
                color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                border: isActive ? "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "1px solid transparent",
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── View Mode ─── */}
      <SectionLabel>View Mode</SectionLabel>
      <div className="mx-3 flex gap-1.5">
        {([
          { value: "simple" as const, icon: Eye, label: "Simple" },
          { value: "advanced" as const, icon: Settings2, label: "Advanced" },
          { value: "auto" as const, icon: Monitor, label: "Auto" },
        ]).map(({ value, icon: Icon, label }) => {
          const isActive = viewPref === value;
          return (
            <button
              key={value}
              onClick={() => setViewPref(value)}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 text-[10px] font-semibold tracking-wide transition-all"
              style={{
                background: isActive ? "var(--surface-selected)" : "transparent",
                color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                border: isActive ? "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "1px solid transparent",
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── Sidebar Layout ─── */}
      {layoutOptions && (
        <>
          <SectionLabel>Sidebar Layout</SectionLabel>
          <div className="mx-1 flex flex-col">
            <PanelButton
              icon={Save}
              label={savingPersonal ? "Saving..." : "Save as My Default"}
              onClick={handleSavePersonal}
              disabled={savingPersonal}
            />
            {layoutOptions.isAdmin && (
              <PanelButton
                icon={LayoutGrid}
                label={savingGlobal ? "Saving..." : "Save as Default for All"}
                onClick={handleSaveGlobal}
                disabled={savingGlobal}
                accent
              />
            )}
            {layoutOptions.hasCustomLayout && (
              <PanelButton
                icon={RotateCcw}
                label="Reset to Default"
                onClick={layoutOptions.onResetLayout}
                muted
              />
            )}
            {layoutOptions.hiddenSections.length > 0 && (
              <div className="mt-2 mx-2 rounded-lg py-1.5" style={{ background: "var(--surface-secondary)" }}>
                <div
                  className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Hidden
                </div>
                {layoutOptions.hiddenSections.map(({ id, title }) => (
                  <button
                    key={id}
                    onClick={() => layoutOptions.onShowSection(id)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--hover-bg)] rounded"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Eye className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                    Show {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Footer ─── */}
      <div className="mt-auto">
        {/* Env badge + version */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-2"
          style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "4px" }}
        >
          {envLabel && envSidebarColor ? (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide"
              style={{
                background: `color-mix(in srgb, ${envSidebarColor} 12%, transparent)`,
                color: envSidebarColor,
                border: `1px solid color-mix(in srgb, ${envSidebarColor} 25%, transparent)`,
              }}
            >
              {envLabel}
            </span>
          ) : (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide"
              style={{
                background: "color-mix(in srgb, var(--status-success-text) 12%, transparent)",
                color: "var(--status-success-text)",
                border: "1px solid color-mix(in srgb, var(--status-success-text) 25%, transparent)",
              }}
            >
              LIVE
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: "var(--text-placeholder)" }}>
            v{process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0"}
          </span>
        </div>

        {/* Tour trigger */}
        <div className="px-3 pb-2">
          <TourTrigger className="w-full justify-center py-2 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors" />
        </div>

        {/* Sign out */}
        <div className="px-3 pb-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-all"
            style={{
              color: "var(--status-error-text)",
              background: "color-mix(in srgb, var(--status-error-text) 5%, transparent)",
              border: "1px solid color-mix(in srgb, var(--status-error-text) 10%, transparent)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--status-error-text) 10%, transparent)";
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--status-error-text) 20%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--status-error-text) 5%, transparent)";
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--status-error-text) 10%, transparent)";
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

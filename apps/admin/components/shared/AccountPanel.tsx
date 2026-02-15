"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronRight,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Mail,
  Ticket,
  Save,
  RotateCcw,
  Eye,
  LayoutGrid,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
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

interface AccountPanelProps {
  onClose: () => void;
  onNavigate?: () => void;
  unreadCount?: number;
  layoutOptions?: LayoutOptions;
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

/* ── Reusable section heading ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
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
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  badge?: number;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
      style={{ color: accent ? "var(--accent-primary)" : "var(--text-secondary)" }}
    >
      <Icon
        className="h-[18px] w-[18px] flex-shrink-0"
        style={{ color: accent ? "var(--accent-primary)" : "var(--text-muted)" }}
      />
      <span className="flex-1">{label}</span>
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
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:pointer-events-none"
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

export function AccountPanel({ onClose, onNavigate, unreadCount = 0, layoutOptions }: AccountPanelProps) {
  const { data: session } = useSession();
  const { preference, setPreference } = useTheme();
  const user = session?.user;
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);

  if (!user) return null;

  const displayLabel = (user as any).displayName || user.name || user.email || "User";
  const role = user.role || "VIEWER";
  const roleColor = ROLE_COLORS[role] || "#6b7280";

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
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
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
          aria-label="Back to navigation"
        >
          <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* ─── Profile card ─── */}
      <div
        className="mx-2 mt-2 mb-1 flex flex-col items-center gap-3 rounded-xl px-4 py-5"
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
      </div>

      {/* ─── Notifications ─── */}
      <SectionLabel>Notifications</SectionLabel>
      <div className="mx-2 flex flex-col">
        <PanelLink href="/x/messages" icon={Mail} label="Inbox" onClick={handleNavigate} badge={unreadCount} />
        <PanelLink href="/x/tickets" icon={Ticket} label="Tickets" onClick={handleNavigate} />
      </div>

      {/* ─── Account ─── */}
      <SectionLabel>Account</SectionLabel>
      <div className="mx-2 flex flex-col">
        <PanelLink href="/x/account" icon={User} label="My Account" onClick={handleNavigate} />
      </div>

      {/* ─── Appearance ─── */}
      <SectionLabel>Appearance</SectionLabel>
      <div className="mx-2 flex gap-1.5 px-1">
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

      {/* ─── Sidebar Layout ─── */}
      {layoutOptions && (
        <>
          <SectionLabel>Sidebar Layout</SectionLabel>
          <div className="mx-2 flex flex-col">
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
              <div className="mt-2 mx-1 rounded-lg py-1.5" style={{ background: "var(--surface-secondary)" }}>
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
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
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
                background: "color-mix(in srgb, #22c55e 12%, transparent)",
                color: "#16a34a",
                border: "1px solid color-mix(in srgb, #22c55e 25%, transparent)",
              }}
            >
              LIVE
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: "var(--text-placeholder)" }}>
            v{process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0"}
          </span>
        </div>

        {/* Sign out */}
        <div className="px-3 pb-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-all"
            style={{
              color: "#dc2626",
              background: "color-mix(in srgb, #dc2626 5%, transparent)",
              border: "1px solid color-mix(in srgb, #dc2626 10%, transparent)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, #dc2626 10%, transparent)";
              e.currentTarget.style.borderColor = "color-mix(in srgb, #dc2626 20%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, #dc2626 5%, transparent)";
              e.currentTarget.style.borderColor = "color-mix(in srgb, #dc2626 10%, transparent)";
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

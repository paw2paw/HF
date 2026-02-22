"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Lock,
  Check,
  Info,
  User,
  Calendar,
  Building2,
  Shield,
} from "lucide-react";
import { useTheme, usePalette, type ThemePreference } from "@/contexts";
import { UserAvatar, ROLE_COLORS, computeInitials } from "@/components/shared/UserAvatar";
import "./account.css";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  EDUCATOR: "Educator",
  SUPER_TESTER: "Super Tester",
  TESTER: "Tester",
  STUDENT: "Student",
  DEMO: "Demo",
  VIEWER: "Viewer",
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: "light", label: "Light", icon: "sun", description: "Bright and clear" },
  { value: "dark", label: "Dark", icon: "moon", description: "Easy on the eyes" },
  { value: "system", label: "System", icon: "monitor", description: "Match your device" },
];

const themeIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
};

function ThemeIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const Icon = themeIcons[icon];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.5} />;
}

interface AccountUser {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarInitials: string | null;
  image: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  assignedDomainId: string | null;
  assignedDomain: { id: string; name: string; slug: string } | null;
}

export default function AccountPage() {
  const { data: session, update: updateSession } = useSession();
  const { preference, setPreference, resolvedTheme } = useTheme();
  const {
    lightPalette,
    darkPalette,
    setLightPalette,
    setDarkPalette,
    lightPresets,
    darkPresets,
  } = usePalette();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [avatarInitials, setAvatarInitials] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) {
          setUser(data.user);
          setDisplayName(data.user.displayName || "");
          setName(data.user.name || "");
          setAvatarInitials(data.user.avatarInitials || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const save = useCallback(
    (fields: { displayName?: string; name?: string; avatarInitials?: string }, refreshSession = false) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          });
          const data = await res.json();
          if (data.ok) {
            setUser((prev) => (prev ? { ...prev, ...data.user } : prev));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            // Refresh JWT so TopBar avatar picks up changes immediately
            if (refreshSession) await updateSession();
          }
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [updateSession],
  );

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    save({ displayName: val });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    save({ name: val });
  };

  const handleInitialsChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
    setAvatarInitials(cleaned);
    save({ avatarInitials: cleaned }, true);
  };

  if (loading) {
    return (
      <div className="acct-loading">
        <div className="hf-spinner" />
      </div>
    );
  }

  if (!user || !session?.user) {
    return (
      <div className="acct-empty">
        <div className="acct-empty-text">Not signed in</div>
      </div>
    );
  }

  const roleColor = ROLE_COLORS[user.role] || "var(--text-muted)";

  return (
    <div className="acct-page">
      {/* Header */}
      <div className="acct-header">
        <h1 className="hf-page-title">
          My Account
        </h1>
        <p className="hf-page-subtitle">
          Profile, appearance, and session details
        </p>
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <div className={`acct-save-indicator ${saved ? "acct-save-saved" : "acct-save-saving"}`}>
          {saved ? <Check size={16} /> : null}
          {saving ? "Saving changes..." : "Changes saved"}
        </div>
      )}

      {/* Profile section */}
      <div className="hf-card">
        <h2 className="hf-section-title">
          Profile
        </h2>
        <p className="acct-section-desc">
          Your identity and how the system addresses you
        </p>

        {/* Avatar + role badge + initials editor */}
        <div className="acct-profile-hero">
          <div className="acct-avatar-col">
            <UserAvatar
              name={user.displayName || user.name || user.email}
              initials={avatarInitials || undefined}
              role={user.role}
              userId={user.id}
              size={64}
            />
            <input
              type="text"
              value={avatarInitials}
              onChange={(e) => handleInitialsChange(e.target.value)}
              placeholder={computeInitials(user.displayName || user.name || user.email)}
              maxLength={3}
              className="acct-initials-input"
              title="Custom avatar initials (max 3 letters)"
            />
          </div>
          <div className="acct-hero-info">
            <div className="acct-hero-name">
              {user.displayName || user.name || user.email}
            </div>
            <span
              className="acct-role-badge"
              style={{
                background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                color: roleColor,
              }}
            >
              <Shield size={11} />
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

        {/* Form fields */}
        <div className="acct-form-grid">
          {/* Display Name */}
          <div>
            <label className="hf-label">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="How the system addresses you"
              className="hf-input"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="hf-label">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Your full name"
              className="hf-input"
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="acct-readonly-label">
            <Lock size={11} />
            Email
          </label>
          <div className="acct-readonly-field">
            {user.email}
          </div>
        </div>
      </div>

      {/* Appearance section */}
      <div className="hf-card">
        <h2 className="hf-section-title">
          Appearance
        </h2>
        <p className="acct-section-desc">
          Choose your preferred color mode
        </p>

        {/* Theme selector — 3-column grid with icon boxes */}
        <div className="acct-theme-grid">
          {THEME_OPTIONS.map((option) => {
            const isSelected = mounted && preference === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setPreference(option.value)}
                className={`acct-theme-btn ${isSelected ? "acct-theme-btn-selected" : ""}`}
              >
                {isSelected && (
                  <div className="acct-theme-check">
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                )}
                <div className={`acct-theme-icon-box ${isSelected ? "acct-theme-icon-box-selected" : ""}`}>
                  <ThemeIcon icon={option.icon} size={22} />
                </div>
                <div className="hf-text-center">
                  <div className="acct-theme-label">
                    {option.label}
                  </div>
                  <div className="acct-theme-desc">
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Palettes — side by side */}
        <div className="acct-palette-grid">
          {/* Light palette */}
          <div className="acct-palette-panel">
            <div className="acct-palette-header">
              <Sun size={14} className="acct-palette-header-icon" />
              <span className="acct-palette-title">
                Light Palette
              </span>
            </div>
            <p className="acct-palette-desc">
              Background tones for light mode
            </p>
            <div className="acct-palette-list">
              {lightPresets.map((preset) => {
                const isSelected = mounted && lightPalette === preset.id;
                const isActive = mounted && resolvedTheme === "light" && isSelected;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setLightPalette(preset.id)}
                    className={`acct-palette-btn ${isSelected ? "acct-palette-btn-selected" : ""}`}
                    style={{ background: preset.light.surfacePrimary }}
                  >
                    <div className="acct-swatch-row">
                      {[
                        preset.light.background,
                        preset.light.surfacePrimary,
                        preset.light.surfaceSecondary,
                        preset.light.surfaceTertiary,
                      ].map((color, i) => (
                        <div
                          key={i}
                          className="acct-swatch acct-swatch-light"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <div className="acct-palette-info">
                      <div className="acct-palette-name">
                        {preset.name}
                      </div>
                      <div className="acct-palette-detail">{preset.description}</div>
                    </div>
                    {isActive && (
                      <div className="acct-active-dot" />
                    )}
                    {isSelected && !isActive && (
                      <div className="acct-selected-check">
                        <Check size={12} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dark palette */}
          <div className="acct-palette-panel">
            <div className="acct-palette-header">
              <Moon size={14} className="acct-palette-header-icon" />
              <span className="acct-palette-title">
                Dark Palette
              </span>
            </div>
            <p className="acct-palette-desc">
              Background tones for dark mode
            </p>
            <div className="acct-palette-list">
              {darkPresets.map((preset) => {
                const isSelected = mounted && darkPalette === preset.id;
                const isActive = mounted && resolvedTheme === "dark" && isSelected;
                const colors = preset.dark!;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setDarkPalette(preset.id)}
                    className={`acct-palette-btn ${isSelected ? "acct-palette-btn-selected" : ""}`}
                    style={{ background: colors.surfacePrimary }}
                  >
                    <div className="acct-swatch-row">
                      {[
                        colors.background,
                        colors.surfacePrimary,
                        colors.surfaceSecondary,
                        colors.surfaceTertiary,
                      ].map((color, i) => (
                        <div
                          key={i}
                          className="acct-swatch acct-swatch-dark"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <div className="acct-palette-info">
                      <div className="acct-palette-name">
                        {preset.name}
                      </div>
                      <div className="acct-palette-detail">{preset.description}</div>
                    </div>
                    {isActive && (
                      <div className="acct-active-dot" />
                    )}
                    {isSelected && !isActive && (
                      <div className="acct-selected-check">
                        <Check size={12} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Session details */}
      <div className="hf-card">
        <h2 className="hf-section-title">
          Session
        </h2>
        <p className="acct-section-desc">
          Your current session and account details
        </p>

        <div className="acct-session-list">
          {/* Role */}
          <div className="acct-session-row acct-session-row-border">
            <div className="acct-session-icon">
              <Shield size={16} />
            </div>
            <div className="acct-session-info">
              <div className="acct-session-label">Role</div>
              <div className="acct-session-value">
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>

          {/* Domain */}
          {user.assignedDomain && (
            <div className="acct-session-row acct-session-row-border">
              <div className="acct-session-icon">
                <Building2 size={16} />
              </div>
              <div className="acct-session-info">
                <div className="acct-session-label">
                  Institution
                </div>
                <div className="acct-session-value">
                  {user.assignedDomain.name}
                </div>
              </div>
            </div>
          )}

          {/* Member since */}
          <div className="acct-session-row">
            <div className="acct-session-icon">
              <Calendar size={16} />
            </div>
            <div className="acct-session-info">
              <div className="acct-session-label">
                Member since
              </div>
              <div className="acct-session-value">
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="acct-signout-btn"
      >
        <LogOut size={16} />
        Sign Out
      </button>

      {/* Footer info */}
      <div className="acct-footer">
        <div className="acct-footer-icon">
          <Info size={18} strokeWidth={1.5} />
        </div>
        <div>
          <div className="acct-footer-title">
            Changes saved automatically
          </div>
          <div className="acct-footer-desc">
            Profile changes sync to the server. Theme preferences are stored locally in your browser.
          </div>
        </div>
      </div>
    </div>
  );
}

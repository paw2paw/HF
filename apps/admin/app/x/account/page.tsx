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
import { UserAvatar, ROLE_COLORS } from "@/components/shared/UserAvatar";

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
  image: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  assignedDomainId: string | null;
  assignedDomain: { id: string; name: string; slug: string } | null;
}

export default function AccountPage() {
  const { data: session } = useSession();
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
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const save = useCallback(
    (fields: { displayName?: string; name?: string }) => {
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
          }
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [],
  );

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    save({ displayName: val });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    save({ name: val });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid var(--border-default)",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!user || !session?.user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Not signed in</div>
      </div>
    );
  }

  const roleColor = ROLE_COLORS[user.role] || "#6b7280";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px" }}>
      {/* Header */}
      <div style={{ paddingTop: 12, marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          My Account
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Profile, appearance, and session details
        </p>
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            background: saved
              ? "color-mix(in srgb, var(--status-success-text) 10%, transparent)"
              : "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
            border: saved
              ? "1px solid color-mix(in srgb, var(--status-success-text) 30%, transparent)"
              : "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            color: saved ? "var(--status-success-text)" : "var(--accent-primary)",
            transition: "all 0.2s ease",
          }}
        >
          {saved ? <Check size={16} /> : null}
          {saving ? "Saving changes..." : "Changes saved"}
        </div>
      )}

      {/* Profile section */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Profile
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Your identity and how the system addresses you
        </p>

        {/* Avatar + role badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            padding: 16,
            background: "var(--surface-secondary)",
            borderRadius: 12,
          }}
        >
          <UserAvatar
            name={user.displayName || user.name || user.email}
            role={user.role}
            userId={user.id}
            size={64}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              {user.displayName || user.name || user.email}
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Display Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="How the system addresses you"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            />
          </div>

          {/* Full Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Your full name"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 6,
            }}
          >
            <Lock size={11} />
            Email
          </label>
          <div
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-tertiary)",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            {user.email}
          </div>
        </div>
      </div>

      {/* Appearance section */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Appearance
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Choose your preferred color mode
        </p>

        {/* Theme selector — 3-column grid with icon boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = mounted && preference === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setPreference(option.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "20px 16px",
                  borderRadius: 12,
                  border: isSelected
                    ? "2px solid var(--accent-primary)"
                    : "1px solid var(--border-default)",
                  background: isSelected
                    ? "var(--surface-secondary)"
                    : "var(--surface-primary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                )}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--surface-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isSelected ? "var(--accent-primary)" : "var(--text-muted)",
                  }}
                >
                  <ThemeIcon icon={option.icon} size={22} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {option.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Palettes — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Light palette */}
          <div
            style={{
              background: "var(--surface-secondary)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Sun size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Light Palette
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
              Background tones for light mode
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {lightPresets.map((preset) => {
                const isSelected = mounted && lightPalette === preset.id;
                const isActive = mounted && resolvedTheme === "light" && isSelected;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setLightPalette(preset.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: isSelected
                        ? "2px solid var(--accent-primary)"
                        : "1px solid var(--border-default)",
                      background: preset.light.surfacePrimary,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      {[
                        preset.light.background,
                        preset.light.surfacePrimary,
                        preset.light.surfaceSecondary,
                        preset.light.surfaceTertiary,
                      ].map((color, i) => (
                        <div
                          key={i}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            background: color,
                            border: "1px solid rgba(0,0,0,0.1)",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                        {preset.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{preset.description}</div>
                    </div>
                    {isActive && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--status-success-text)",
                          boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {isSelected && !isActive && (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "var(--accent-primary)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={12} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dark palette */}
          <div
            style={{
              background: "var(--surface-secondary)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Moon size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Dark Palette
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
              Background tones for dark mode
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {darkPresets.map((preset) => {
                const isSelected = mounted && darkPalette === preset.id;
                const isActive = mounted && resolvedTheme === "dark" && isSelected;
                const colors = preset.dark!;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setDarkPalette(preset.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: isSelected
                        ? "2px solid var(--accent-primary)"
                        : "1px solid #3f3f46",
                      background: colors.surfacePrimary,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      {[
                        colors.background,
                        colors.surfacePrimary,
                        colors.surfaceSecondary,
                        colors.surfaceTertiary,
                      ].map((color, i) => (
                        <div
                          key={i}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            background: color,
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#e5e7eb" }}>
                        {preset.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{preset.description}</div>
                    </div>
                    {isActive && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--status-success-text)",
                          boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {isSelected && !isActive && (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "var(--accent-primary)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
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
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Session
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Your current session and account details
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Role */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--surface-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <Shield size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>Role</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>

          {/* Domain */}
          {user.assignedDomain && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 0",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--surface-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                <Building2 size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                  Institution
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {user.assignedDomain.name}
                </div>
              </div>
            </div>
          )}

          {/* Member since */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--surface-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <Calendar size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                Member since
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
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
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid color-mix(in srgb, var(--status-error-text) 25%, transparent)",
          background: "color-mix(in srgb, var(--status-error-text) 4%, transparent)",
          color: "var(--status-error-text)",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s ease",
          marginBottom: 24,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "color-mix(in srgb, var(--status-error-text) 10%, transparent)";
          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--status-error-text) 40%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "color-mix(in srgb, var(--status-error-text) 4%, transparent)";
          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--status-error-text) 25%, transparent)";
        }}
      >
        <LogOut size={16} />
        Sign Out
      </button>

      {/* Footer info */}
      <div
        style={{
          padding: 16,
          background: "var(--surface-secondary)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--surface-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          <Info size={18} strokeWidth={1.5} />
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: 2,
            }}
          >
            Changes saved automatically
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Profile changes sync to the server. Theme preferences are stored locally in your browser.
          </div>
        </div>
      </div>
    </div>
  );
}

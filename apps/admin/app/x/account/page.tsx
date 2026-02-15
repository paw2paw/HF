"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut, Lock, Check } from "lucide-react";
import { useTheme, usePalette, type ThemePreference } from "@/contexts";
import { UserAvatar, ROLE_COLORS } from "@/components/shared/UserAvatar";

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

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

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
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch account data
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

  useEffect(() => { setMounted(true); }, []);

  // Debounced save
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
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (!user || !session?.user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Not signed in
        </div>
      </div>
    );
  }

  const roleColor = ROLE_COLORS[user.role] || "#6b7280";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1
        className="mb-6 text-lg font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        My Account
      </h1>

      {/* Profile section */}
      <section
        className="mb-6 rounded-xl border p-5"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--surface-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-4">
          <UserAvatar
            name={user.displayName || user.name || user.email}
            role={user.role}
            userId={user.id}
            size={64}
          />
          <div>
            <div
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {user.displayName || user.name || user.email}
            </div>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: `color-mix(in srgb, ${roleColor} 18%, transparent)`,
                color: roleColor,
              }}
            >
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

        {/* Save indicator */}
        {(saving || saved) && (
          <div
            className="mb-3 text-[11px] font-medium"
            style={{ color: saved ? "#059669" : "var(--text-muted)" }}
          >
            {saving ? "Saving..." : "Saved"}
          </div>
        )}

        {/* Display Name */}
        <div className="mb-3">
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="How the system addresses you"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Full Name */}
        <div className="mb-3">
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label
            className="mb-1 flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            <Lock className="h-3 w-3" />
            Email
          </label>
          <div
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--surface-tertiary)",
              color: "var(--text-muted)",
            }}
          >
            {user.email}
          </div>
        </div>
      </section>

      {/* Appearance section */}
      <section
        className="mb-6 rounded-xl border p-5"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--surface-primary)",
        }}
      >
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Appearance
        </h2>

        {/* Theme selector */}
        <div className="mb-5 flex gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = preference === value;
            return (
              <button
                key={value}
                onClick={() => setPreference(value)}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-colors"
                style={{
                  borderColor: isActive
                    ? "var(--accent-primary)"
                    : "var(--border-subtle)",
                  background: isActive
                    ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)"
                    : "transparent",
                  color: isActive
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Light palette */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Light Palette
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {lightPresets.map((preset) => {
              const isSelected = mounted && lightPalette === preset.id;
              const isActive = mounted && resolvedTheme === "light" && isSelected;
              return (
                <button
                  key={preset.id}
                  onClick={() => setLightPalette(preset.id)}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all"
                  style={{
                    border: isSelected
                      ? "2px solid var(--accent-primary)"
                      : "1px solid var(--border-default)",
                    background: preset.light.surfacePrimary,
                    cursor: "pointer",
                  }}
                >
                  <div className="flex gap-1 flex-shrink-0">
                    {[preset.light.background, preset.light.surfacePrimary, preset.light.surfaceSecondary, preset.light.surfaceTertiary].map((color, i) => (
                      <div
                        key={i}
                        className="rounded"
                        style={{ width: 14, height: 14, background: color, border: "1px solid rgba(0,0,0,0.1)" }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium" style={{ color: "#374151" }}>{preset.name}</div>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>{preset.description}</div>
                  </div>
                  {isActive && (
                    <div className="h-2 w-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} />
                  )}
                  {isSelected && !isActive && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "var(--accent-primary)", color: "white" }}>
                      <Check size={12} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark palette */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Dark Palette
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {darkPresets.map((preset) => {
              const isSelected = mounted && darkPalette === preset.id;
              const isActive = mounted && resolvedTheme === "dark" && isSelected;
              const colors = preset.dark!;
              return (
                <button
                  key={preset.id}
                  onClick={() => setDarkPalette(preset.id)}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all"
                  style={{
                    border: isSelected
                      ? "2px solid var(--accent-primary)"
                      : "1px solid #3f3f46",
                    background: colors.surfacePrimary,
                    cursor: "pointer",
                  }}
                >
                  <div className="flex gap-1 flex-shrink-0">
                    {[colors.background, colors.surfacePrimary, colors.surfaceSecondary, colors.surfaceTertiary].map((color, i) => (
                      <div
                        key={i}
                        className="rounded"
                        style={{ width: 14, height: 14, background: color, border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium" style={{ color: "#e5e7eb" }}>{preset.name}</div>
                    <div className="text-[10px]" style={{ color: "#9ca3af" }}>{preset.description}</div>
                  </div>
                  {isActive && (
                    <div className="h-2 w-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} />
                  )}
                  {isSelected && !isActive && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "var(--accent-primary)", color: "white" }}>
                      <Check size={12} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Session info */}
      <section
        className="mb-6 rounded-xl border p-5"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--surface-primary)",
        }}
      >
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Session
        </h2>
        <div className="flex flex-col gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Role</span>
            <span>{ROLE_LABELS[user.role] || user.role}</span>
          </div>
          {user.assignedDomain && (
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Domain</span>
              <span>{user.assignedDomain.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Member since</span>
            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors"
        style={{
          borderColor: "color-mix(in srgb, #dc2626 30%, transparent)",
          color: "#dc2626",
          background: "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "color-mix(in srgb, #dc2626 6%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
}

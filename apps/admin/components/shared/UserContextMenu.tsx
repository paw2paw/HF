"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  User,
  Settings2,
  VenetianMask,
  Search,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useMasquerade } from "@/contexts/MasqueradeContext";
import { UserAvatar, ROLE_COLORS } from "./UserAvatar";

interface UserContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  unreadCount?: number;
  masqueradeOptions?: {
    isRealAdmin: boolean;
  };
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

export function UserContextMenu({
  isOpen,
  onClose,
  anchorRef,
  masqueradeOptions,
}: UserContextMenuProps) {
  const { data: session } = useSession();
  const { preference: theme, setPreference: setTheme } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [stepInOpen, setStepInOpen] = useState(false);
  const [stepInSearch, setStepInSearch] = useState("");
  const [stepInUsers, setStepInUsers] = useState<{ id: string; email: string; name: string | null; displayName: string | null; role: string }[]>([]);
  const [stepInLoading, setStepInLoading] = useState(false);
  const stepInSearchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isMasquerading, startMasquerade } = useMasquerade();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Fetch users for step-in picker
  const fetchStepInUsers = useCallback(async (q: string) => {
    setStepInLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/admin/masquerade/users${params}`);
      if (res.ok) {
        const data = await res.json();
        setStepInUsers(data.users || []);
      }
    } finally {
      setStepInLoading(false);
    }
  }, []);

  // Fetch when step-in expands or search changes
  useEffect(() => {
    if (!stepInOpen) return;
    const timer = setTimeout(() => fetchStepInUsers(stepInSearch), 200);
    return () => clearTimeout(timer);
  }, [stepInOpen, stepInSearch, fetchStepInUsers]);

  // Auto-focus search when step-in expands
  useEffect(() => {
    if (stepInOpen) stepInSearchRef.current?.focus();
  }, [stepInOpen]);

  // Reset submenus when menu closes
  useEffect(() => {
    if (!isOpen) {
      setAppearanceOpen(false);
      setStepInOpen(false);
      setStepInSearch("");
      setStepInUsers([]);
    }
  }, [isOpen]);

  // Calculate fixed position from anchor button
  useEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen, anchorRef]);

  // Close on outside click / escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !session?.user || !pos) return null;

  const userName = session.user.name || session.user.email || "User";
  const userRole = session.user.role;
  const roleLabel = ROLE_LABELS[userRole] || userRole;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: "transparent" }}
      />

      {/* Menu popover — fixed position calculated from anchor button */}
      <div
        ref={menuRef}
        className="fixed z-50 w-72 rounded-xl border overflow-hidden"
        style={{
          background: "var(--surface-primary)",
          borderColor: "var(--border-default)",
          top: pos.top + 4,
          right: pos.right,
          boxShadow:
            "0 20px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* User header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <UserAvatar
              name={userName}
              role={userRole}
              size={44}
            />
            <div className="flex-1 min-w-0">
              <div
                className="font-semibold text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {userName}
              </div>
              <div
                className="text-xs truncate mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="p-2">
          {/* My Account */}
          <Link
            href="/x/account"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-primary)" }}
          >
            <User className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
            My Account
          </Link>

          {/* Settings */}
          <Link
            href="/x/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-primary)" }}
          >
            <Settings2 className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
            Settings
          </Link>

          {/* Appearance submenu */}
          <div>
            <button
              onClick={() => setAppearanceOpen(!appearanceOpen)}
              className="w-full text-left flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-primary)", border: "none", background: "transparent", cursor: "pointer" }}
            >
              <span className="flex items-center gap-3">
                <Sun className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
                Appearance
              </span>
              <ChevronRight
                className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                style={{
                  color: "var(--text-muted)",
                  transform: appearanceOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Appearance submenu items */}
            {appearanceOpen && (
              <div className="mx-2 mb-1 p-1.5 rounded-lg bg-[var(--surface-secondary)]">
                {["light", "dark", "system"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTheme(mode as "light" | "dark" | "system");
                      setAppearanceOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-[13px] rounded-md transition-colors"
                    style={{
                      color:
                        theme === mode ? "var(--accent-primary)" : "var(--text-secondary)",
                      background:
                        theme === mode ? "var(--surface-primary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: theme === mode ? 500 : 400,
                    }}
                  >
                    {mode === "light" && <Sun className="w-4 h-4" />}
                    {mode === "dark" && <Moon className="w-4 h-4" />}
                    {mode === "system" && <Monitor className="w-4 h-4" />}
                    <span className="capitalize">{mode === "system" ? "System" : mode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Masquerade (if admin and not already masquerading) */}
          {masqueradeOptions?.isRealAdmin && !isMasquerading && (
            <div>
              <button
                onClick={() => setStepInOpen(!stepInOpen)}
                className="w-full text-left flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
                style={{ color: "var(--text-primary)", border: "none", background: "transparent", cursor: "pointer" }}
              >
                <span className="flex items-center gap-3">
                  <VenetianMask className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
                  Step In As…
                </span>
                <ChevronRight
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                  style={{ color: "var(--text-muted)", transform: stepInOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                />
              </button>

              {stepInOpen && (
                <div className="mx-2 mb-1 p-2 rounded-lg bg-[var(--surface-secondary)]">
                  {/* Search input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                    <input
                      ref={stepInSearchRef}
                      type="text"
                      value={stepInSearch}
                      onChange={(e) => setStepInSearch(e.target.value)}
                      placeholder="Search users…"
                      className="w-full rounded-md border pl-8 pr-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]"
                      style={{
                        borderColor: "var(--border-default)",
                        background: "var(--surface-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  {/* User list */}
                  <div className="max-h-44 overflow-y-auto">
                    {stepInLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
                      </div>
                    ) : stepInUsers.length === 0 ? (
                      <div className="py-3 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                        No users found
                      </div>
                    ) : (
                      stepInUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            await startMasquerade(u.id);
                            onClose();
                          }}
                          className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-md transition-colors hover:bg-[var(--hover-bg)]"
                          style={{ color: "var(--text-primary)", border: "none", background: "transparent", cursor: "pointer" }}
                        >
                          <UserAvatar name={u.displayName || u.name || u.email} role={u.role} size={24} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-[13px]">{u.displayName || u.name || u.email}</div>
                            <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {ROLE_LABELS[u.role] || u.role}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="border-t mx-2"
          style={{ borderColor: "var(--border-subtle)" }}
        />

        {/* Sign out */}
        <div className="p-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-secondary)", border: "none", background: "transparent", cursor: "pointer" }}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

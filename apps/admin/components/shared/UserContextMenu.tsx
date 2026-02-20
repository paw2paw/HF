"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const { theme, setTheme } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isMasquerading } = useMasquerade();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

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
        className="fixed z-50 w-56 rounded-lg shadow-lg border"
        style={{
          background: "var(--surface-primary)",
          borderColor: "var(--border-default)",
          top: pos.top,
          right: pos.right,
          boxShadow:
            "0 10px 25px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* User header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <UserAvatar
              name={userName}
              role={userRole}
              size={40}
            />
            <div className="flex-1 min-w-0">
              <div
                className="font-medium text-[13px] truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {userName}
              </div>
              <div
                className="text-[11px] truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {/* My Account */}
          <Link
            href="/x/account"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            My Account
          </Link>

          {/* Settings */}
          <Link
            href="/x/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Settings2 className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>

          {/* Appearance submenu */}
          <div>
            <button
              onClick={() => setAppearanceOpen(!appearanceOpen)}
              className="w-full text-left flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-secondary)", border: "none", background: "transparent", cursor: "pointer" }}
            >
              <span className="flex items-center gap-3">
                <Sun className="w-4 h-4 flex-shrink-0" />
                Appearance
              </span>
              <ChevronRight
                className="w-3 h-3 flex-shrink-0 transition-transform"
                style={{
                  transform: appearanceOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Appearance submenu items */}
            {appearanceOpen && (
              <div className="px-2 py-1 bg-[var(--surface-secondary)]">
                {["light", "dark", "auto"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTheme(mode as "light" | "dark" | "auto");
                      setAppearanceOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-[12px] rounded transition-colors"
                    style={{
                      color:
                        theme === mode ? "var(--accent-primary)" : "var(--text-secondary)",
                      background:
                        theme === mode ? "var(--surface-primary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {mode === "light" && <Sun className="w-3.5 h-3.5" />}
                    {mode === "dark" && <Moon className="w-3.5 h-3.5" />}
                    {mode === "auto" && <Monitor className="w-3.5 h-3.5" />}
                    <span className="capitalize">{mode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Masquerade (if admin and not already masquerading) */}
          {masqueradeOptions?.isRealAdmin && !isMasquerading && (
            <Link
              href="/x/account?tab=masquerade"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <VenetianMask className="w-4 h-4 flex-shrink-0" />
              Step In As…
            </Link>
          )}
        </div>

        {/* Divider */}
        <div
          className="border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        />

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
          style={{ color: "var(--text-secondary)", border: "none", background: "transparent", cursor: "pointer" }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );
}

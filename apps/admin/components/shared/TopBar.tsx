"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMasquerade } from "@/contexts/MasqueradeContext";
import { VenetianMask, X } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { UserContextMenu } from "./UserContextMenu";

export function TopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const { masquerade, isMasquerading, stopMasquerade } = useMasquerade();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu on pathname change
  useEffect(() => {
    setShowMenu(false);
  }, [pathname]);

  const realRole = session?.user?.role as string | undefined;
  const realIsAdmin = realRole === "ADMIN" || realRole === "SUPERADMIN";

  if (!session?.user) return null;

  const masqueradeName = masquerade?.name || masquerade?.email || "Unknown";

  return (
    <header
      className="sticky top-0 w-full h-12 flex items-center justify-between border-b flex-shrink-0"
      style={{
        background: "var(--surface-primary)",
        borderColor: "var(--border-subtle)",
        zIndex: 25,
        paddingLeft: 32,
        paddingRight: 40,
      }}
    >
      {/* Left: masquerade status chip */}
      <div className="flex items-center">
        {isMasquerading && masquerade && (
          <div
            role="status"
            aria-label={`Viewing as ${masqueradeName}`}
            className="flex items-center gap-2 rounded-full px-3 py-1"
            style={{
              background: "var(--masquerade-color)",
              color: "var(--surface-primary)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <VenetianMask size={14} />
            <span>
              Viewing as <strong>{masqueradeName}</strong> ({masquerade.role})
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                stopMasquerade();
              }}
              className="flex items-center justify-center rounded-full ml-1 transition-colors"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "var(--surface-primary)",
                width: 20,
                height: 20,
                cursor: "pointer",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
              title="Exit masquerade"
              aria-label="Exit masquerade"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Right: avatar */}
      <div className="ml-auto">
        <button
          ref={triggerRef}
          onClick={() => setShowMenu((v) => !v)}
          className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
          title="Account"
          aria-label="Account menu"
        >
          <UserAvatar
            name={session.user.name || session.user.email || "?"}
            initials={session.user.avatarInitials}
            role={realRole}
            size={32}
          />
        </button>

        <UserContextMenu
          isOpen={showMenu}
          onClose={() => setShowMenu(false)}
          anchorRef={triggerRef}
          masqueradeOptions={realIsAdmin ? { isRealAdmin: true } : undefined}
        />
      </div>
    </header>
  );
}

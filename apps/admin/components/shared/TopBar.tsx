"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMasquerade } from "@/contexts/MasqueradeContext";
import { UserAvatar } from "./UserAvatar";
import { UserContextMenu } from "./UserContextMenu";

export function TopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const { isMasquerading, effectiveRole } = useMasquerade();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu on pathname change
  useEffect(() => {
    setShowMenu(false);
  }, [pathname]);

  const realRole = session?.user?.role as string | undefined;
  const realIsAdmin = realRole === "ADMIN" || realRole === "SUPERADMIN";

  if (!session?.user) return null;

  return (
    <header
      className="sticky top-0 w-full h-12 flex items-center justify-end pl-6 pr-12 border-b flex-shrink-0"
      style={{
        background: "var(--surface-primary)",
        borderColor: "var(--border-subtle)",
        zIndex: 25,
      }}
    >
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

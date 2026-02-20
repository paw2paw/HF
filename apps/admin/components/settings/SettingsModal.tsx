"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useSettingsModal } from "@/contexts/SettingsContext";
import SettingsClient from "@/app/x/settings/SettingsClient";

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettingsModal();
  const router = useRouter();

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSettings();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSettings]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={closeSettings}
        style={{
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        style={{
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        <div
          className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto"
          style={{
            borderColor: "var(--border-default)",
            border: "1px solid var(--border-default)",
            animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Settings
            </h2>
            <button
              onClick={closeSettings}
              className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-auto">
            <SettingsClient onClose={closeSettings} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

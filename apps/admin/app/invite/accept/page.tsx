"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBranding } from "@/contexts/BrandingContext";

interface InviteDetails {
  email: string;
  firstName: string | null;
  lastName: string | null;
  domainName: string | null;
  expiresAt: string;
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Ambient gold glow */}
      <div
        className="login-glow pointer-events-none absolute"
        style={{
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--login-gold) 15%, transparent) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { branding } = useBranding();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link — no token found.");
      setLoading(false);
      return;
    }

    fetch(`/api/invite/verify?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.invite) {
          setInvite(data.invite);
          setFirstName(data.invite.firstName || "");
          setLastName(data.invite.lastName || "");
        } else {
          setError(data.error || "Invalid or expired invite.");
        }
      })
      .catch(() => setError("Failed to load invite."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        router.push("/x/sim");
      } else {
        setError(data.error || "Failed to accept invite.");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AuthPageShell>
        <div className="flex items-center gap-3" style={{ color: "var(--login-blue)" }}>
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading invite...
        </div>
      </AuthPageShell>
    );
  }

  // Error state (no invite loaded)
  if (error && !invite) {
    return (
      <AuthPageShell>
        <div className="login-card w-full max-w-md text-center">
          <div
            className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
            style={{
              background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
              border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
            }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--status-error-text) 15%, transparent)" }}
            >
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: "color-mix(in srgb, var(--status-error-text) 60%, white)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Invite Not Valid
            </h1>
            <p style={{ color: "var(--login-blue)" }} className="mb-6">
              {error}
            </p>
            <a
              href="/login"
              className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: "color-mix(in srgb, var(--login-blue) 15%, transparent)",
                color: "var(--login-blue)",
              }}
            >
              Go to Login
            </a>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  // Accept form
  return (
    <AuthPageShell>
      <div className="login-card w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="mx-auto mb-4 h-14"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden"
              style={{
                background: "var(--login-navy-light)",
                boxShadow: "0 4px 24px color-mix(in srgb, var(--login-gold) 20%, transparent)",
              }}
            >
              <img src="/icons/icon.svg" alt="HF" className="h-10 w-10 rounded-lg" />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Welcome to {branding.name}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--login-blue)" }}>
            {invite?.domainName
              ? `You're invited to test ${invite.domainName}`
              : "You're invited to test our AI system"}
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
            border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--login-blue)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={invite?.email || ""}
                disabled
                className="w-full rounded-lg px-4 py-3"
                style={{
                  background: "color-mix(in srgb, var(--login-navy-light) 60%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--login-blue) 10%, transparent)",
                  color: "color-mix(in srgb, var(--login-blue) 70%, transparent)",
                }}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--login-blue)" }}
              >
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                autoFocus={!invite?.firstName}
                className="login-input w-full rounded-lg px-4 py-3 text-white placeholder-neutral-500 transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--login-navy-light) 80%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--login-blue) 15%, transparent)",
                }}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--login-blue)" }}
              >
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                required
                className="login-input w-full rounded-lg px-4 py-3 text-white placeholder-neutral-500 transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--login-navy-light) 80%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--login-blue) 15%, transparent)",
                }}
              />
            </div>

            {error && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--status-error-text) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-error-text) 20%, transparent)",
                  color: "color-mix(in srgb, var(--status-error-text) 60%, white)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !firstName.trim() || !lastName.trim()}
              className="login-btn w-full rounded-lg px-4 py-3 font-semibold transition-all"
              style={{
                background: branding.primaryColor || "var(--login-gold)",
                color: "var(--login-navy)",
                boxShadow: "0 0 20px color-mix(in srgb, var(--login-gold) 25%, transparent)",
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating your account...
                </span>
              ) : (
                "Accept & Continue"
              )}
            </button>
          </form>

          <div
            className="mt-6 pt-4 text-center text-xs"
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--login-blue) 15%, transparent)",
              color: "color-mix(in srgb, var(--login-blue) 60%, transparent)",
            }}
          >
            You&apos;ll get instant access to the call simulator
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}

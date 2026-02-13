"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface InviteDetails {
  email: string;
  firstName: string | null;
  lastName: string | null;
  domainName: string | null;
  expiresAt: string;
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex items-center gap-3 text-neutral-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading invite...
        </div>
      </div>
    );
  }

  // Error state (no invite loaded)
  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Invite Not Valid
            </h1>
            <p className="mb-6 text-neutral-400">{error}</p>
            <a
              href="/login"
              className="inline-block rounded-lg bg-neutral-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-600"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Accept form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-lg">
            HF
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome to HF</h1>
          <p className="mt-2 text-neutral-400">
            {invite?.domainName
              ? `You're invited to test ${invite.domainName}`
              : "You're invited to test our AI system"}
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Email
              </label>
              <input
                type="email"
                value={invite?.email || ""}
                disabled
                className="w-full rounded-lg border border-neutral-600 bg-neutral-700/30 px-4 py-3 text-neutral-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                autoFocus={!invite?.firstName}
                className="w-full rounded-lg border border-neutral-600 bg-neutral-700/50 px-4 py-3 text-white placeholder-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                required
                className="w-full rounded-lg border border-neutral-600 bg-neutral-700/50 px-4 py-3 text-white placeholder-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !firstName.trim() || !lastName.trim()}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="mt-6 border-t border-neutral-700 pt-4 text-center text-xs text-neutral-500">
            You&apos;ll get instant access to the HF call simulator
          </div>
        </div>
      </div>
    </div>
  );
}

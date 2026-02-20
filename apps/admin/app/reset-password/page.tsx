"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBranding } from "@/contexts/BrandingContext";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { branding } = useBranding();

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No reset token provided");
      setLoading(false);
      return;
    }

    // Verify token
    fetch(`/api/auth/verify-reset-token?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.email) {
          setTokenValid(true);
          setEmail(data.email);
        } else {
          setError(data.error || "Invalid or expired reset link");
        }
      })
      .catch(() => setError("Failed to verify reset link"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="login-card w-full max-w-md">
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
            border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
          }}
        >
          <div className="flex items-center gap-3" style={{ color: "var(--login-blue)" }}>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verifying link...
          </div>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (error && !tokenValid) {
    return (
      <div className="login-card w-full max-w-md">
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center"
          style={{
            background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
            border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, #ef4444 15%, transparent)" }}
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "#fca5a5" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">
            Link Expired
          </h1>
          <p style={{ color: "var(--login-blue)" }} className="mb-6">
            {error}
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: "color-mix(in srgb, var(--login-blue) 15%, transparent)",
              color: "var(--login-blue)",
            }}
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="login-card w-full max-w-md">
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center"
          style={{
            background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
            border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, #10b981 15%, transparent)" }}
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "#86efac" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">
            Password Updated
          </h1>
          <p style={{ color: "var(--login-blue)" }} className="mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: "color-mix(in srgb, var(--login-blue) 15%, transparent)",
              color: "var(--login-blue)",
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="login-card w-full max-w-md">
      {/* Logo & Brand */}
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
          Create New Password
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--login-blue)" }}>
          Enter a strong password below
        </p>
      </div>

      {/* Form Card */}
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
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--login-blue)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
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
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--login-blue)" }}
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              className="login-input w-full rounded-lg px-4 py-3 text-white placeholder-neutral-500 transition-colors"
              style={{
                background: "color-mix(in srgb, var(--login-navy-light) 80%, transparent)",
                border: "1px solid color-mix(in srgb, var(--login-blue) 15%, transparent)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--login-blue)" }}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
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
                background: "color-mix(in srgb, #ef4444 10%, transparent)",
                border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password || !confirmPassword}
            className="login-btn w-full rounded-lg px-4 py-3 font-semibold transition-all"
            style={{
              background: branding.primaryColor || "var(--login-gold)",
              color: "var(--login-navy)",
              boxShadow: "0 0 20px color-mix(in srgb, var(--login-gold) 25%, transparent)",
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Resetting...
              </span>
            ) : (
              "Reset Password"
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
          <Link href="/login" className="hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useBranding } from "@/contexts/BrandingContext";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { branding } = useBranding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to send reset link.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Submitted state
  if (submitted) {
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
            Check your email
          </h1>
          <p style={{ color: "var(--login-blue)" }} className="mb-6">
            If an account exists for <strong>{email}</strong>, we've sent a
            password reset link. It expires in 1 hour.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: "color-mix(in srgb, var(--login-blue) 15%, transparent)",
              color: "var(--login-blue)",
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

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
          Reset Password
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--login-blue)" }}>
          Enter your email to receive a reset link
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
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
            disabled={isLoading || !email}
            className="login-btn w-full rounded-lg px-4 py-3 font-semibold transition-all"
            style={{
              background: branding.primaryColor || "var(--login-gold)",
              color: "var(--login-navy)",
              boxShadow: "0 0 20px color-mix(in srgb, var(--login-gold) 25%, transparent)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending link...
              </span>
            ) : (
              "Send Reset Link"
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

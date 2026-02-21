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
        <div className="login-form-card text-center">
          <div className="login-icon-circle-sm login-icon-circle-success">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
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
          <p className="login-text mb-6">
            If an account exists for <strong>{email}</strong>, we've sent a
            password reset link. It expires in 1 hour.
          </p>
          <Link href="/login" className="login-btn-secondary">
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
          <div className="login-logo">
            <img src="/icons/icon.svg" alt="HF" className="h-10 w-10 rounded-lg" />
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Reset Password
        </h1>
        <p className="login-text mt-2 text-sm">
          Enter your email to receive a reset link
        </p>
      </div>

      {/* Form Card */}
      <div className="login-form-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="login-label">
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
              className="login-input"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="login-btn"
            style={branding.primaryColor ? { background: branding.primaryColor } : undefined}
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

        <div className="login-footer">
          <Link href="/login">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}

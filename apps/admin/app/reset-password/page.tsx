"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useBranding } from "@/contexts/BrandingContext";
import Link from "next/link";

export default function ResetPasswordPage() {
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
        body: JSON.stringify({ token, password }),
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
        <div className="login-form-card flex items-center justify-center">
          <div className="login-text flex items-center gap-3">
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
        <div className="login-form-card text-center">
          <div className="login-icon-circle-sm login-icon-circle-error">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">
            Link Expired
          </h1>
          <p className="login-text mb-6">
            {error}
          </p>
          <Link href="/forgot-password" className="login-btn-secondary">
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
            Password Updated
          </h1>
          <p className="login-text mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <Link href="/login" className="login-btn-secondary">
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
          <div className="login-logo">
            <img src="/icons/icon.svg" alt="HF" className="h-10 w-10 rounded-lg" />
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Create New Password
        </h1>
        <p className="login-text mt-2 text-sm">
          Enter a strong password below
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
              disabled
              className="login-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="login-label">
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
              className="login-input"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="login-label">
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
              className="login-input"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting || !password || !confirmPassword}
            className="login-btn"
            style={branding.primaryColor ? { background: branding.primaryColor } : undefined}
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

        <div className="login-footer">
          <Link href="/login">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}

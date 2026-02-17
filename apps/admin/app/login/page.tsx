"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useBranding } from "@/contexts/BrandingContext";
import { showEnvBanner, envSidebarColor, envLabel } from "@/components/shared/EnvironmentBanner";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/x";
  const { branding } = useBranding();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      } else {
        setError("Unexpected response. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-card w-full max-w-md">
      {/* Environment Banner — non-prod only */}
      {showEnvBanner && envSidebarColor && envLabel && (
        <div
          className="mb-6 rounded-xl px-5 py-3 text-center font-semibold tracking-wide"
          style={{
            background: `color-mix(in srgb, ${envSidebarColor} 20%, transparent)`,
            border: `2px solid ${envSidebarColor}`,
            color: envSidebarColor,
          }}
        >
          <div className="text-lg">{envLabel} ENVIRONMENT</div>
          <div className="mt-1 text-xs font-normal opacity-80">v{APP_VERSION}</div>
        </div>
      )}

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
          {branding.name}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--login-blue)" }}>
          {branding.welcomeMessage || "Sign in to continue"}
        </p>
      </div>

      {/* Login Card */}
      <div
        className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
          border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
        }}
      >
        <form onSubmit={handleLogin} className="space-y-5">
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

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--login-blue)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
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
            disabled={isLoading || !email || !password}
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
                Signing in...
              </span>
            ) : (
              "Sign in"
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
          Admin access only. Testers use their invite link.
        </div>
      </div>
    </div>
  );
}

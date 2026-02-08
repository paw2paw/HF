"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/x";

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("[Login] Attempting credentials login for:", email);
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      console.log("[Login] Result:", result);

      if (result?.error) {
        console.log("[Login] Error:", result.error);
        setError(`Login failed: ${result.error}`);
      } else if (result?.ok) {
        console.log("[Login] Success, redirecting to:", callbackUrl);
        window.location.href = callbackUrl;
      } else {
        console.log("[Login] Unexpected result");
        setError("Unexpected response from auth");
      }
    } catch (err) {
      console.error("[Login] Exception:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("email", {
        email,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Unable to send magic link. Check email configuration.");
      } else if (result?.ok) {
        window.location.href = "/login/verify";
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo/Brand */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-lg">
          HF
        </div>
        <h1 className="text-2xl font-semibold text-white">HF Admin</h1>
        <p className="mt-2 text-neutral-400">Sign in to your account</p>
      </div>

      {/* Login Card */}
      <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
        {!showMagicLink ? (
          // Password Login Form
          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-neutral-300"
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
                className="w-full rounded-lg border border-neutral-600 bg-neutral-700/50 px-4 py-3 text-white placeholder-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-neutral-300"
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
              disabled={isLoading || !email || !password}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowMagicLink(true)}
                className="text-sm text-neutral-400 hover:text-white"
              >
                Use magic link instead
              </button>
            </div>
          </form>
        ) : (
          // Magic Link Form
          <form onSubmit={handleMagicLink} className="space-y-5">
            <div>
              <label
                htmlFor="email-magic"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Email address
              </label>
              <input
                id="email-magic"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              disabled={isLoading || !email}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send magic link"}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowMagicLink(false)}
                className="text-sm text-neutral-400 hover:text-white"
              >
                Use password instead
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 border-t border-neutral-700 pt-4 text-center text-xs text-neutral-500">
          Default password for new users: <code className="text-neutral-400">admin123</code>
        </div>
      </div>
    </div>
  );
}

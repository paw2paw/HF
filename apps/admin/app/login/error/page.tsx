"use client";

import { useSearchParams } from "next/navigation";

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "AccessDenied":
        return "Access denied. You may not have a valid invite.";
      case "Verification":
        return "The verification link has expired or has already been used.";
      default:
        return "An error occurred during authentication.";
    }
  };

  return (
    <div className="login-card w-full max-w-md text-center">
      {/* Error Icon */}
      <div
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "color-mix(in srgb, #ef4444 15%, transparent)",
        }}
      >
        <svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "#fca5a5" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Error Message */}
      <div
        className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
          border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
        }}
      >
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Authentication Error
        </h1>
        <p style={{ color: "var(--login-blue)" }} className="mb-6">
          {getErrorMessage(error)}
        </p>
        {error && (
          <p
            className="text-sm"
            style={{ color: "color-mix(in srgb, var(--login-blue) 50%, transparent)" }}
          >
            Error code: {error}
          </p>
        )}
      </div>

      {/* Back link */}
      <a
        href="/login"
        className="mt-6 inline-block text-sm transition-colors hover:text-white"
        style={{ color: "var(--login-blue)" }}
      >
        &larr; Try again
      </a>
    </div>
  );
}

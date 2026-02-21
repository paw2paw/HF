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
      <div className="login-icon-circle login-icon-circle-error">
        <svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Error Message */}
      <div className="login-form-card">
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Authentication Error
        </h1>
        <p className="login-text mb-6">
          {getErrorMessage(error)}
        </p>
        {error && (
          <p className="login-text-muted text-sm">
            Error code: {error}
          </p>
        )}
      </div>

      {/* Back link */}
      <a href="/login" className="login-back-link">
        &larr; Try again
      </a>
    </div>
  );
}

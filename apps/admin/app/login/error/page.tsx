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
    <div className="w-full max-w-md text-center">
      {/* Error Icon */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 text-red-400">
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
      <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Authentication Error
        </h1>
        <p className="mb-6 text-neutral-400">{getErrorMessage(error)}</p>
        {error && (
          <p className="text-sm text-neutral-500">Error code: {error}</p>
        )}
      </div>

      {/* Back link */}
      <a
        href="/login"
        className="mt-6 inline-block text-sm text-neutral-400 hover:text-white"
      >
        &larr; Try again
      </a>
    </div>
  );
}

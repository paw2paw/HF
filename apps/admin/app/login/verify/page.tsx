export default function VerifyPage() {
  return (
    <div className="w-full max-w-md text-center">
      {/* Success Icon */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-400">
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Message */}
      <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Check your email
        </h1>
        <p className="mb-6 text-neutral-400">
          We sent a magic link to your email address. Click the link to sign in.
        </p>
        <p className="text-sm text-neutral-500">
          The link will expire in 24 hours. If you don&apos;t see the email,
          check your spam folder.
        </p>
      </div>

      {/* Back link */}
      <a
        href="/login"
        className="mt-6 inline-block text-sm text-neutral-400 hover:text-white"
      >
        &larr; Back to login
      </a>
    </div>
  );
}

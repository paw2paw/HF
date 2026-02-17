export default function VerifyPage() {
  return (
    <div className="login-card w-full max-w-md text-center">
      {/* Email Icon */}
      <div
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "color-mix(in srgb, var(--login-gold) 15%, transparent)",
        }}
      >
        <svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "var(--login-gold)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Message */}
      <div
        className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--login-navy) 70%, transparent)",
          border: "1px solid color-mix(in srgb, var(--login-blue) 20%, transparent)",
        }}
      >
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Check your email
        </h1>
        <p style={{ color: "var(--login-blue)" }} className="mb-6">
          We sent a sign-in link to your email address. Click the link to continue.
        </p>
        <p
          className="text-sm"
          style={{ color: "color-mix(in srgb, var(--login-blue) 60%, transparent)" }}
        >
          The link will expire in 24 hours. If you don&apos;t see the email,
          check your spam folder.
        </p>
      </div>

      {/* Back link */}
      <a
        href="/login"
        className="mt-6 inline-block text-sm transition-colors hover:text-white"
        style={{ color: "var(--login-blue)" }}
      >
        &larr; Back to login
      </a>
    </div>
  );
}

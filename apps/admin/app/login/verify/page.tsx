export default function VerifyPage() {
  return (
    <div className="login-card w-full max-w-md text-center">
      {/* Email Icon */}
      <div className="login-icon-circle login-icon-circle-gold">
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
      <div className="login-form-card">
        <h1 className="mb-4 text-2xl font-semibold text-white">
          Check your email
        </h1>
        <p className="login-text mb-6">
          We sent a sign-in link to your email address. Click the link to continue.
        </p>
        <p className="login-text-muted text-sm">
          The link will expire in 24 hours. If you don&apos;t see the email,
          check your spam folder.
        </p>
      </div>

      {/* Back link */}
      <a href="/login" className="login-back-link">
        &larr; Back to login
      </a>
    </div>
  );
}

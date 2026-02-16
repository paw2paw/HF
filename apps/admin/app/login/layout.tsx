export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Ambient gold glow behind the card */}
      <div
        className="login-glow pointer-events-none absolute"
        style={{
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--login-gold) 15%, transparent) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

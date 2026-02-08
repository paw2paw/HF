// Login layout - just a wrapper, no html/body (those come from root layout)
// The login pages bypass the sidebar via conditional in root layout

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4">
      {children}
    </div>
  );
}

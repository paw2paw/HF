import "./globals.css";

export const metadata = {
  title: "HF Admin",
  description: "Admin interface for HF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
import SidebarNav from "../components/shared/SidebarNav";

export const metadata = { title: "HF Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <div style={{ display: "flex" }}>
          <SidebarNav />
          <main style={{ padding: 20, width: "100%" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

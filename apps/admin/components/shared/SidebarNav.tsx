export default function SidebarNav() {
  const links = [
    { href: "/cockpit", label: "Cockpit" },
    { href: "/parameters", label: "Parameters" },
    { href: "/prompt-preview", label: "Prompt Preview" },
    { href: "/services", label: "Services" },
    { href: "/sessions", label: "Sessions" },
    { href: "/import", label: "Import" },
  ];

  return (
    <aside style={{ padding: 16, borderRight: "1px solid #ddd", minHeight: "100vh", width: 220 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>HF Admin</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((l) => (
          <a key={l.href} href={l.href} style={{ textDecoration: "none" }}>
            {l.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

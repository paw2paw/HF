import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5, ADMIN: 4, OPERATOR: 3, SUPER_TESTER: 2, TESTER: 1, DEMO: 0, VIEWER: 1,
};

export default async function ContentHubPage() {
  const session = await auth();
  const userLevel = ROLE_LEVEL[session?.user?.role ?? ""] ?? 0;
  if (userLevel < ROLE_LEVEL.OPERATOR) redirect("/x");

  let sourcesCount = 0,
    subjectsCount = 0,
    assertionsCount = 0;

  try {
    const counts = await Promise.all([
      prisma.contentSource.count().catch(() => 0),
      prisma.subject.count().catch(() => 0),
      prisma.contentAssertion.count().catch(() => 0),
    ]);
    [sourcesCount, subjectsCount, assertionsCount] = counts;
  } catch {
    console.warn("[ContentHub] Database not fully initialized");
  }

  const stats = [
    { label: "Sources", value: sourcesCount, href: "/x/content-sources", icon: "📖" },
    { label: "Subjects", value: subjectsCount, href: "/x/subjects", icon: "📚" },
    { label: "Assertions", value: assertionsCount, href: "/x/content-review", icon: "📋" },
  ];

  const items = [
    { title: "Subjects", description: "Browse and manage curriculum subjects", href: "/x/subjects", icon: "📚" },
    { title: "Sources", description: "Manage verified content sources", href: "/x/content-sources", icon: "🛡️" },
    { title: "Review", description: "Review and approve content assertions", href: "/x/content-review", icon: "✅" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>📚</span>
          Content
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {sourcesCount} verified sources, {subjectsCount} subjects, {assertionsCount} assertions in pipeline
        </p>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", transition: "all 0.2s" }} className="home-stat-card">
              <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--button-primary-bg)", lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{stat.label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 16 }}>
          {items.map((item) => (
            <Link key={item.title} href={item.href} style={{ display: "block", padding: 20, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", transition: "all 0.2s" }} className="home-action-card">
              <div style={{ fontSize: 28, marginBottom: 12, filter: "grayscale(0.2)" }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>{item.description}</div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .home-stat-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover > div:nth-child(2) { color: var(--button-primary-bg) !important; }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

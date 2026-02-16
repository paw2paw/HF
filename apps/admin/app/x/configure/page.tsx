import { requirePageAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ConfigureHubPage() {
  await requirePageAuth("OPERATOR");

  let domainsCount = 0,
    playbooksCount = 0,
    activeSpecsCount = 0,
    promptTemplatesCount = 0;

  try {
    const counts = await Promise.all([
      prisma.domain.count().catch(() => 0),
      prisma.playbook.count().catch(() => 0),
      prisma.analysisSpec.count({ where: { isActive: true } }).catch(() => 0),
      prisma.promptTemplate.count().catch(() => 0),
    ]);
    [domainsCount, playbooksCount, activeSpecsCount, promptTemplatesCount] = counts;
  } catch {
    console.warn("[ConfigureHub] Database not fully initialized");
  }

  const stats = [
    { label: "Domains", value: domainsCount, href: "/x/domains", icon: "🌐" },
    { label: "Playbooks", value: playbooksCount, href: "/x/playbooks", icon: "📚" },
    { label: "Active Specs", value: activeSpecsCount, href: "/x/specs", icon: "📋" },
    { label: "Templates", value: promptTemplatesCount, href: "/x/playbooks", icon: "📝" },
  ];

  const items = [
    { title: "Domains", description: "Manage business domains and their settings", href: "/x/domains", icon: "🌐" },
    { title: "Playbooks", description: "Create and edit analysis playbooks", href: "/x/playbooks", icon: "📚" },
    { title: "Specs", description: "Configure analysis specifications", href: "/x/specs", icon: "📋" },
    { title: "Flows", description: "Design workflow pipelines", href: "/x/flows", icon: "🔀" },
    { title: "Taxonomy", description: "Explore the parameter taxonomy", href: "/x/taxonomy-graph", icon: "🔮" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>⚙️</span>
          Configure
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {domainsCount} domains, {playbooksCount} playbooks, {activeSpecsCount} active specs
        </p>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
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
          div[style*="gridTemplateColumns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="gridTemplateColumns: repeat(5"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

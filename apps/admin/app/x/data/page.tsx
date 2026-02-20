import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DataHubPage() {
  let callersCount = 0,
    callsCount = 0,
    memoriesCount = 0,
    goalsCount = 0;

  try {
    const counts = await Promise.all([
      prisma.caller.count().catch(() => 0),
      prisma.call.count().catch(() => 0),
      prisma.callerMemory.count().catch(() => 0),
      prisma.goal.count().catch(() => 0),
    ]);
    [callersCount, callsCount, memoriesCount, goalsCount] = counts;
  } catch {
    console.warn("[DataHub] Database not fully initialized");
  }

  const stats = [
    { label: "Callers", value: callersCount, href: "/x/callers", icon: "👥" },
    { label: "Calls", value: callsCount, href: "/x/callers", icon: "📞" },
    { label: "Memories", value: memoriesCount, href: "/x/callers", icon: "🧠" },
    { label: "Goals", value: goalsCount, href: "/x/goals", icon: "🎯" },
  ];

  const items = [
    { title: "Callers", description: "View and manage caller profiles", href: "/x/callers", icon: "👥" },
    { title: "Sim", description: "Test conversations with simulated callers", href: "/x/sim", icon: "💬" },
    { title: "Dictionary", description: "Browse personality parameters and traits", href: "/x/dictionary", icon: "📖" },
    { title: "Goals", description: "Define and track caller learning goals", href: "/x/goals", icon: "🎯" },
    { title: "Import", description: "Import transcripts and external data", href: "/x/import", icon: "📥" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>📊</span>
          Data
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {callersCount} callers onboarded, {callsCount} calls processed, {memoriesCount} memories extracted
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

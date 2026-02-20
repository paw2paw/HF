import { requirePageAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SystemHealthPanel } from "@/components/shared/SystemHealthPanel";

export default async function SystemHubPage() {
  await requirePageAuth("ADMIN");

  let usersCount = 0,
    activeAIConfigsCount = 0,
    pipelineRunsCount = 0,
    settingsCount = 0;

  try {
    const counts = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.aIConfig.count({ where: { isActive: true } }).catch(() => 0),
      prisma.pipelineRun.count().catch(() => 0),
      prisma.systemSetting.count().catch(() => 0),
    ]);
    [usersCount, activeAIConfigsCount, pipelineRunsCount, settingsCount] = counts;
  } catch {
    console.warn("[SystemHub] Database not fully initialized");
  }

  const stats = [
    { label: "Team Members", value: usersCount, href: "/x/users", icon: "👤" },
    { label: "AI Configs", value: activeAIConfigsCount, href: "/x/ai-config", icon: "🤖" },
    { label: "Pipeline Runs", value: pipelineRunsCount, href: "/x/pipeline", icon: "⚡" },
    { label: "Settings", value: settingsCount, href: "/x/settings", icon: "⚙️" },
  ];

  const items = [
    { title: "Metering", description: "Monitor API usage and costs", href: "/x/metering", icon: "📊" },
    { title: "AI Config", description: "Configure AI models and call points", href: "/x/ai-config", icon: "🤖" },
    { title: "AI Errors", description: "Review AI interaction errors", href: "/x/ai-errors", icon: "⚠️" },
    { title: "AI Knowledge", description: "Browse AI learned patterns", href: "/x/ai-knowledge", icon: "🧠" },
    { title: "Team", description: "Manage team members and roles", href: "/x/users", icon: "👥" },
    { title: "Settings", description: "System settings and appearance", href: "/x/settings", icon: "⚙️" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>🖥️</span>
          System
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {usersCount} team members, {activeAIConfigsCount} active AI configs, {pipelineRunsCount} pipeline runs
        </p>
      </div>

      {/* System Health — SUPERADMIN only, client component fetches /api/system/ini */}
      <SystemHealthPanel />

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
        <div style={{ display: "grid", gridTemplateColumns: `repeat(3, 1fr)`, gap: 16 }}>
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
          div[style*="gridTemplateColumns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

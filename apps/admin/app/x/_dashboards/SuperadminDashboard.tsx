import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AskAISearchBar from "@/components/shared/AskAISearchBar";

export default async function SuperadminDashboard() {
  let domainsCount = 0,
    playbooksCount = 0,
    callersCount = 0,
    specsCount = 0,
    parametersCount = 0;
  let recentCalls: Array<{ id: string; createdAt: Date; caller: { id: string; name: string | null } | null }> = [];

  try {
    const [counts, calls] = await Promise.all([
      Promise.all([
        prisma.domain.count().catch(() => 0),
        prisma.playbook.count().catch(() => 0),
        prisma.caller.count().catch(() => 0),
        prisma.analysisSpec.count().catch(() => 0),
        prisma.parameter.count().catch(() => 0),
      ]),
      prisma.call.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          caller: { select: { id: true, name: true } },
        },
      }).catch(() => []),
    ]);
    [domainsCount, playbooksCount, callersCount, specsCount, parametersCount] = counts;
    recentCalls = calls;
  } catch (error) {
    console.warn("Database not fully initialized - showing 0 counts");
  }

  const stats = [
    { label: "Institutions", value: domainsCount, href: "/x/domains", icon: "🌐" },
    { label: "Courses", value: playbooksCount, href: "/x/playbooks", icon: "📚" },
    { label: "Callers", value: callersCount, href: "/x/callers", icon: "👥" },
    { label: "Specs", value: specsCount, href: "/x/specs", icon: "📐" },
    { label: "Parameters", value: parametersCount, href: "/x/dictionary", icon: "🌳" },
  ];

  const workflowSections = [
    {
      title: "Prompt Engineering",
      description: "Tune and validate your AI prompts",
      items: [
        { title: "Prompt Tuner", description: "Fine-tune prompt output for a specific caller", href: "/x/playground?mode=caller", icon: "🧪" },
        { title: "Compare Courses", description: "A/B test two course configurations", href: "/x/playground?mode=compare", icon: "📒📒" },
        { title: "Validate Course", description: "Test a course across multiple callers", href: "/x/playground?mode=playbook", icon: "✅" },
      ],
    },
    {
      title: "Data Management",
      description: "Manage callers, goals, and import data",
      items: [
        { title: "Callers", description: "View and manage caller profiles", href: "/x/callers", icon: "👥" },
        { title: "Goals", description: "Define and track caller goals", href: "/x/goals", icon: "🎯" },
        { title: "Import", description: "Import transcripts and caller data", href: "/x/import", icon: "📥" },
        { title: "Data Management", description: "Import specs, transcripts, and manage system data", href: "/x/data-management", icon: "🌱" },
      ],
    },
    {
      title: "Configuration",
      description: "Configure institutions, courses, and specs",
      items: [
        { title: "Institutions", description: "Manage institutions", href: "/x/domains", icon: "🌐" },
        { title: "Courses", description: "Create and edit courses", href: "/x/playbooks", icon: "📚" },
        { title: "Specs", description: "Analysis specifications", href: "/x/specs", icon: "📐" },
        { title: "Taxonomy", description: "Parameters, variables, and patterns", href: "/x/dictionary", icon: "🌳" },
      ],
    },
  ];

  return (
    <div data-tour="welcome">
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>🏠</span>
              HumanFirst Studio
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
              Build, test, and deploy conversational AI experiences
            </p>
          </div>
          <div style={{ width: 320, flexShrink: 0 }}>
            <AskAISearchBar placeholder="Ask AI anything..." />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", transition: "all 0.2s" }} className="home-stat-card">
              <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--button-primary-bg)", lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{stat.label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {workflowSections.map((section) => (
          <div key={section.title}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{section.title}</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{section.description}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${section.items.length}, 1fr)`, gap: 16 }}>
              {section.items.map((item) => (
                <Link key={item.title} href={item.href} style={{ display: "block", padding: 20, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", transition: "all 0.2s" }} className="home-action-card">
                  <div style={{ fontSize: 28, marginBottom: 12, filter: "grayscale(0.2)" }}>{item.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>{item.description}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Recent Activity</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Latest calls across all callers</p>
        {recentCalls.length === 0 ? (
          <div style={{ padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No calls yet</p>
          </div>
        ) : (
          <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
            {recentCalls.map((call, i) => (
              <Link key={call.id} href={`/x/callers/${call.caller?.id}?tab=calls`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < recentCalls.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none", transition: "background 0.15s" }} className="home-recent-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-success-text)", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{call.caller?.name || "Unknown Caller"}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(call.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 24, justifyContent: "center" }}>
        {[
          { href: "/x/pipeline", icon: "📜", label: "Run History" },
          { href: "/x/metering", icon: "📈", label: "Metering" },
          { href: "/x/ai-config", icon: "🤖", label: "AI Config" },
          { href: "/x/taxonomy-graph", icon: "🌳", label: "Taxonomy Graph" },
        ].map((link) => (
          <Link key={link.href} href={link.href} style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }} className="home-footer-link">
            <span>{link.icon}</span> {link.label}
          </Link>
        ))}
      </div>

      <style>{`
        .home-stat-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover > div:nth-child(2) { color: var(--button-primary-bg) !important; }
        .home-recent-row:hover { background: var(--hover-bg) !important; }
        .home-footer-link:hover { color: var(--button-primary-bg) !important; }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(5"] { grid-template-columns: repeat(3, 1fr) !important; }
          div[style*="gridTemplateColumns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="gridTemplateColumns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

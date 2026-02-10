import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AskAISearchBar from "@/components/shared/AskAISearchBar";

export default async function XDashboardPage() {
  // Fetch system stats (with fallback for missing tables)
  let domainsCount = 0,
    playbooksCount = 0,
    callersCount = 0,
    specsCount = 0,
    parametersCount = 0;

  try {
    const counts = await Promise.all([
      prisma.domain.count().catch(() => 0),
      prisma.playbook.count().catch(() => 0),
      prisma.caller.count().catch(() => 0),
      prisma.analysisSpec.count().catch(() => 0),
      prisma.parameter.count().catch(() => 0),
    ]);
    [domainsCount, playbooksCount, callersCount, specsCount, parametersCount] = counts;
  } catch (error) {
    // If tables don't exist, just use 0 for all counts
    console.warn("Database not fully initialized - showing 0 counts");
  }

  const stats = [
    { label: "Domains", value: domainsCount, href: "/x/domains", icon: "🌐" },
    { label: "Playbooks", value: playbooksCount, href: "/x/playbooks", icon: "📚" },
    { label: "Callers", value: callersCount, href: "/x/callers", icon: "👥" },
    { label: "Specs", value: specsCount, href: "/x/specs", icon: "📐" },
    { label: "Parameters", value: parametersCount, href: "/x/taxonomy", icon: "🌳" },
  ];

  const workflowSections = [
    {
      title: "Prompt Engineering",
      description: "Tune and validate your AI prompts",
      items: [
        {
          title: "Prompt Tuner",
          description: "Fine-tune prompt output for a specific caller",
          href: "/x/playground?mode=caller",
          icon: "🧪",
        },
        {
          title: "Compare Playbooks",
          description: "A/B test two playbook configurations",
          href: "/x/playground?mode=compare",
          icon: "📒📒",
        },
        {
          title: "Validate Playbook",
          description: "Test a playbook across multiple callers",
          href: "/x/playground?mode=playbook",
          icon: "✅",
        },
      ],
    },
    {
      title: "Data Management",
      description: "Manage callers, goals, and import data",
      items: [
        {
          title: "Callers",
          description: "View and manage caller profiles",
          href: "/x/callers",
          icon: "👥",
        },
        {
          title: "Goals",
          description: "Define and track caller goals",
          href: "/x/goals",
          icon: "🎯",
        },
        {
          title: "Import",
          description: "Import transcripts and caller data",
          href: "/x/import",
          icon: "📥",
        },
        {
          title: "Data Management",
          description: "Import specs, transcripts, and manage system data",
          href: "/x/data-management",
          icon: "🌱",
        },
      ],
    },
    {
      title: "Configuration",
      description: "Configure domains, playbooks, and specs",
      items: [
        {
          title: "Domains",
          description: "Manage business domains",
          href: "/x/domains",
          icon: "🌐",
        },
        {
          title: "Playbooks",
          description: "Create and edit playbooks",
          href: "/x/playbooks",
          icon: "📚",
        },
        {
          title: "Specs",
          description: "Analysis specifications",
          href: "/x/specs",
          icon: "📐",
        },
        {
          title: "Taxonomy",
          description: "Parameters, variables, and patterns",
          href: "/x/taxonomy",
          icon: "🌳",
        },
      ],
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div>
            <h1 style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 12
            }}>
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

      {/* System Stats */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 16,
        }}>
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 16px",
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              className="home-stat-card"
            >
              <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--button-primary-bg)",
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}>
                {stat.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Workflow Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {workflowSections.map((section) => (
          <div key={section.title}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}>
                {section.title}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {section.description}
              </p>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${section.items.length}, 1fr)`,
              gap: 16,
            }}>
              {section.items.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: 20,
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                  className="home-action-card"
                >
                  <div style={{
                    fontSize: 28,
                    marginBottom: 12,
                    filter: "grayscale(0.2)",
                  }}>
                    {item.icon}
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 6,
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                  }}>
                    {item.description}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links Footer */}
      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        gap: 24,
        justifyContent: "center",
      }}>
        <Link
          href="/x/pipeline"
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          className="home-footer-link"
        >
          <span>📜</span> Run History
        </Link>
        <Link
          href="/x/metering"
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          className="home-footer-link"
        >
          <span>📈</span> Metering
        </Link>
        <Link
          href="/x/ai-config"
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          className="home-footer-link"
        >
          <span>🤖</span> AI Config
        </Link>
        <Link
          href="/x/taxonomy-graph"
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          className="home-footer-link"
        >
          <span>🌳</span> Taxonomy Graph
        </Link>
      </div>

      {/* Hover styles */}
      <style>{`
        .home-stat-card:hover {
          border-color: var(--button-primary-bg) !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
          transform: translateY(-2px);
        }
        .home-action-card:hover {
          border-color: var(--button-primary-bg) !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
          transform: translateY(-2px);
        }
        .home-action-card:hover > div:nth-child(2) {
          color: var(--button-primary-bg) !important;
        }
        .home-footer-link:hover {
          color: var(--button-primary-bg) !important;
        }
        @media (max-width: 1024px) {
          .home-stat-card {
            grid-column: span 1;
          }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(5"] {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          div[style*="gridTemplateColumns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="gridTemplateColumns: repeat(3"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AskAISearchBar from "@/components/shared/AskAISearchBar";

const TASK_LABELS: Record<string, string> = {
  quick_launch: "Quick Launch",
  content_wizard: "Content Wizard",
  create_spec: "Create Spec",
  configure_caller: "Configure Caller",
  extraction: "Extraction",
  curriculum_generation: "Curriculum",
};

const RESUME_PATHS: Record<string, (ctx: Record<string, any>) => string> = {
  quick_launch: () => "/x/quick-launch",
  content_wizard: () => `/x/content-sources`,
  create_spec: () => "/x/specs",
  configure_caller: (ctx) => ctx.callerId ? `/x/callers/${ctx.callerId}` : "/x/callers",
  extraction: (ctx) => ctx.subjectId ? `/x/subjects/${ctx.subjectId}` : "/x/subjects",
  curriculum_generation: (ctx) => ctx.subjectId ? `/x/subjects/${ctx.subjectId}` : "/x/subjects",
};

export default async function AdminDashboard() {
  let domainsCount = 0,
    playbooksCount = 0,
    callersCount = 0;
  let recentCalls: Array<{ id: string; createdAt: Date; caller: { id: string; name: string | null } | null }> = [];
  let pendingTasks: Array<{ id: string; taskType: string; currentStep: number; totalSteps: number; context: any; updatedAt: Date }> = [];

  try {
    const [counts, calls, tasks] = await Promise.all([
      Promise.all([
        prisma.domain.count().catch(() => 0),
        prisma.playbook.count().catch(() => 0),
        prisma.caller.count().catch(() => 0),
      ]),
      prisma.call.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          caller: { select: { id: true, name: true } },
        },
      }).catch(() => []),
      prisma.userTask.findMany({
        where: { status: "in_progress" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, taskType: true, currentStep: true, totalSteps: true, context: true, updatedAt: true },
      }).catch(() => []),
    ]);
    [domainsCount, playbooksCount, callersCount] = counts;
    recentCalls = calls;
    pendingTasks = tasks;
  } catch (error) {
    console.warn("Database not fully initialized - showing 0 counts");
  }

  const stats = [
    { label: "Institutions", value: domainsCount, href: "/x/domains", icon: "🌐" },
    { label: "Courses", value: playbooksCount, href: "/x/playbooks", icon: "📚" },
    { label: "Callers", value: callersCount, href: "/x/callers", icon: "👥" },
  ];

  const sections = [
    {
      title: "Operations",
      description: "Day-to-day management",
      items: [
        { title: "Callers", description: "View and manage caller profiles", href: "/x/callers", icon: "👥" },
        { title: "Goals", description: "Define and track caller goals", href: "/x/goals", icon: "🎯" },
        { title: "Analytics", description: "View performance dashboards", href: "/x/analytics", icon: "📊" },
      ],
    },
    {
      title: "Configuration",
      description: "Configure institutions and courses",
      items: [
        { title: "Institutions", description: "Manage institutions", href: "/x/domains", icon: "🌐" },
        { title: "Courses", description: "Create and edit courses", href: "/x/playbooks", icon: "📚" },
        { title: "Import", description: "Import transcripts and data", href: "/x/import", icon: "📥" },
      ],
    },
  ];

  return (
    <div data-tour="welcome">
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>📋</span>
              Operations Dashboard
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
              Manage callers, domains, and playbooks
            </p>
          </div>
          <div style={{ width: 320, flexShrink: 0 }}>
            <AskAISearchBar placeholder="Search..." />
          </div>
        </div>
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

      {/* Active Jobs */}
      {pendingTasks.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Active Jobs</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Jobs in progress — pick up where you left off</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingTasks.map((task) => {
              const ctx = (task.context || {}) as Record<string, any>;
              const label = TASK_LABELS[task.taskType] || task.taskType;
              const name = ctx.subjectName || ctx.domainName || ctx.name || "";
              const resumeUrl = RESUME_PATHS[task.taskType]?.(ctx) || "/x/jobs";
              return (
                <Link
                  key={task.id}
                  href={resumeUrl}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                  className="home-recent-row"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
                      color: "var(--accent-primary)",
                      border: "2px solid var(--accent-primary)",
                    }}>
                      {task.currentStep}/{task.totalSteps}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {label}{name ? ` — ${name}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Step {task.currentStep} of {task.totalSteps}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 600 }}>
                    Resume →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {sections.map((section) => (
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
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Recent Activity</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Latest calls across all callers</p>
        </div>
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

      <style>{`
        .home-stat-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover > div:nth-child(2) { color: var(--button-primary-bg) !important; }
        .home-recent-row:hover { background: var(--hover-bg) !important; }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

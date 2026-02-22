import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth";

interface TesterDashboardProps {
  enhanced?: boolean;
}

export default async function TesterDashboard({ enhanced = false }: TesterDashboardProps) {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch tester's own callers and recent calls
  let callerCount = 0;
  let callCount = 0;
  let recentCalls: Array<{ id: string; createdAt: Date; caller: { name: string | null } | null }> = [];
  let domains: Array<{ id: string; slug: string; name: string }> = [];

  try {
    const [callers, calls, domainsResult] = await Promise.all([
      prisma.caller.count({ where: userId ? { userId } : {} }).catch(() => 0),
      prisma.call.count({ where: userId ? { caller: { userId } } : {} }).catch(() => 0),
      enhanced
        ? prisma.domain.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true }, orderBy: { name: "asc" } }).catch(() => [])
        : Promise.resolve([]),
    ]);
    callerCount = callers;
    callCount = calls;
    domains = domainsResult;

    recentCalls = await prisma.call.findMany({
      where: userId ? { caller: { userId } } : {},
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        caller: { select: { name: true } },
      },
    });
  } catch (error) {
    console.warn("TesterDashboard: failed to load data");
  }

  return (
    <div data-tour="welcome">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{enhanced ? "🔬" : "📞"}</span>
          {enhanced ? "Testing Dashboard" : "My Calls"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {enhanced
            ? "Run tests, view results, and manage callers across domains"
            : "View your call history and start new conversations"}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: enhanced ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
        <div style={{ padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--button-primary-bg)", marginBottom: 4 }}>{callerCount}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Callers</div>
        </div>
        <div style={{ padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--button-primary-bg)", marginBottom: 4 }}>{callCount}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Calls</div>
        </div>
        {enhanced && (
          <div style={{ padding: "20px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--button-primary-bg)", marginBottom: 4 }}>{domains.length}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Institutions</div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: enhanced ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
        <Link href="/x/sim" style={{ display: "block", padding: 20, background: "var(--button-primary-bg)", borderRadius: 12, textDecoration: "none", textAlign: "center", transition: "all 0.2s" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 4 }}>Start Conversation</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Launch the simulator</div>
        </Link>
        <Link href="/x/callers" style={{ display: "block", padding: 20, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", textAlign: "center", transition: "all 0.2s" }} className="home-action-card">
          <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>View Callers</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Browse caller profiles</div>
        </Link>
        {enhanced && (
          <Link href="/x/analytics" style={{ display: "block", padding: 20, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, textDecoration: "none", textAlign: "center", transition: "all 0.2s" }} className="home-action-card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Test Results</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>View analytics</div>
          </Link>
        )}
      </div>

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Recent Calls</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentCalls.map((call) => (
              <div key={call.id} style={{ padding: "12px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{call.caller?.name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(call.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institution Selector for SuperTesters */}
      {enhanced && domains.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Available Institutions</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {domains.map((domain) => (
              <div key={domain.id} style={{ padding: "12px 16px", background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{domain.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{domain.slug}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .home-action-card:hover { border-color: var(--button-primary-bg) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
        .home-action-card:hover > div:nth-child(2) { color: var(--button-primary-bg) !important; }
      `}</style>
    </div>
  );
}

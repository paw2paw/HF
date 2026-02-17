import Link from "next/link";

export default function DemoDashboard() {
  return (
    <div data-tour="welcome" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 48 }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>👋</div>

      <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
        Welcome to HumanFirst
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
        Experience AI-powered conversations that adapt to every individual.
        Start a conversation below to see how it works.
      </p>

      <Link
        href="/x/sim"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 32px",
          background: "var(--button-primary-bg)",
          color: "white",
          borderRadius: 12,
          textDecoration: "none",
          fontSize: 18,
          fontWeight: 600,
          transition: "all 0.2s",
        }}
        className="demo-cta"
      >
        <span style={{ fontSize: 24 }}>💬</span>
        Start a Conversation
      </Link>

      <div style={{ marginTop: 48, display: "flex", gap: 24, justifyContent: "center" }}>
        {[
          { icon: "🧠", title: "Adaptive", description: "AI learns your style" },
          { icon: "📊", title: "Measured", description: "Every interaction counts" },
          { icon: "🎯", title: "Personal", description: "Tailored to you" },
        ].map((feature) => (
          <div key={feature.title} style={{ padding: 20, textAlign: "center", flex: 1, maxWidth: 160 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{feature.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{feature.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{feature.description}</div>
          </div>
        ))}
      </div>

      <style>{`
        .demo-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(79, 70, 229, 0.3); }
      `}</style>
    </div>
  );
}

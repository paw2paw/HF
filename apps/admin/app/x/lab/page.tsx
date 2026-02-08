"use client";

export default function LabPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Lab</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Test specs, compare results, and experiment with prompts
        </p>
      </div>

      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>🧪</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
          Coming Soon
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
          The Lab will let you:
          <ul style={{ textAlign: "left", marginTop: 16 }}>
            <li>Test specs against sample text</li>
            <li>Compare results across different spec versions</li>
            <li>Preview generated prompts</li>
            <li>A/B test playbook configurations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default async function ControlDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>Control: {id}</h1>

      <p style={{ marginTop: 8 }}>
        This control represents a versioned, auditable configuration element
        used to shape agent behaviour (e.g. quality, personality, guardrail, or policy).
      </p>

      <p style={{ marginTop: 8 }}>
        Next steps for this screen:
      </p>
      <ul>
        <li>Display the resolved control definition</li>
        <li>Show category (quality / personality / guardrail / etc.)</li>
        <li>Expose low / high bias or target ranges</li>
        <li>Allow override or draft edits</li>
        <li>Link to historical Control Sets that include this control</li>
      </ul>

      <p style={{ marginTop: 16 }}>
        <a href="/derived/control-sets">← Back to Control Sets</a>
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";

type Flags = {
  memoryWrite: boolean;
  memoryRecall: boolean;
  rewards: boolean;
  nudges: boolean;
  guardrailsStrict: boolean;
};

export default function ServiceTogglesPanel() {
  const [flags, setFlags] = useState<Flags>({
    memoryWrite: true,
    memoryRecall: true,
    rewards: false,
    nudges: false,
    guardrailsStrict: true,
  });

  function toggle(k: keyof Flags) {
    setFlags((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Service Toggles</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, maxWidth: 520 }}>
        <label>Memory write</label><input type="checkbox" checked={flags.memoryWrite} onChange={() => toggle("memoryWrite")} />
        <label>Memory recall</label><input type="checkbox" checked={flags.memoryRecall} onChange={() => toggle("memoryRecall")} />
        <label>Rewards / NBM</label><input type="checkbox" checked={flags.rewards} onChange={() => toggle("rewards")} />
        <label>Subscription nudges</label><input type="checkbox" checked={flags.nudges} onChange={() => toggle("nudges")} />
        <label>Guardrails strict</label><input type="checkbox" checked={flags.guardrailsStrict} onChange={() => toggle("guardrailsStrict")} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => alert("Save stub: wire to API")}>Save</button>
      </div>
    </section>
  );
}

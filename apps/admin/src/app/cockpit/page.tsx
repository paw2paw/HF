import SystemStatusCard from "../../components/cockpit/SystemStatusCard";
import ServiceTogglesPanel from "../../components/cockpit/ServiceTogglesPanel";
import ActiveConfigSummary from "../../components/cockpit/ActiveConfigSummary";

export default function CockpitPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Cockpit</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SystemStatusCard />
        <ActiveConfigSummary />
      </div>
      <ServiceTogglesPanel />
    </div>
  );
}

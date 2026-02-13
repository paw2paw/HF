"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield, Eye, Database, Info, Check, Lock, EyeOff,
  Save, RotateCcw, ChevronDown,
} from "lucide-react";

// ── Types ───────────────────────────────────────────

type VisibilityState = "visible" | "hidden_default" | "blocked";

type SidebarVisibilityRules = {
  sections: Record<
    string,
    { requiredRole: string | null; defaultHiddenFor: string[] }
  >;
};

type AccessContract = {
  contractId: string;
  roles: string[];
  matrix: Record<string, Record<string, string>>;
  scopes: Record<string, string>;
  operations: Record<string, string>;
};

// ── Constants ───────────────────────────────────────

const ROLES = ["SUPERADMIN", "ADMIN", "OPERATOR", "SUPER_TESTER", "TESTER", "DEMO"] as const;
const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5, ADMIN: 4, OPERATOR: 3, SUPER_TESTER: 2, TESTER: 1, DEMO: 0,
};

const TABS = [
  { id: "nav", label: "Navigation Visibility", icon: Eye },
  { id: "entity", label: "Entity Access", icon: Database },
] as const;

const VIS_STATES: { value: VisibilityState; label: string; icon: typeof Check; color: string; bg: string }[] = [
  { value: "visible", label: "Visible", icon: Check, color: "#22c55e", bg: "#dcfce7" },
  { value: "hidden_default", label: "Hidden by default", icon: EyeOff, color: "#f59e0b", bg: "#fef3c7" },
  { value: "blocked", label: "Blocked", icon: Lock, color: "#ef4444", bg: "#fee2e2" },
];

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  ALL: { bg: "#dbeafe", text: "#1e40af" },
  DOMAIN: { bg: "#d1fae5", text: "#065f46" },
  OWN: { bg: "#fef3c7", text: "#92400e" },
  NONE: { bg: "transparent", text: "var(--text-muted)" },
};

const OP_COLORS: Record<string, string> = {
  C: "#22c55e", R: "#3b82f6", U: "#f59e0b", D: "#ef4444",
};

// ── Helpers ─────────────────────────────────────────

/**
 * Convert rules to a grid of VisibilityState per (section, role)
 */
function rulesToGrid(
  rules: SidebarVisibilityRules,
  sectionIds: string[]
): Record<string, Record<string, VisibilityState>> {
  const grid: Record<string, Record<string, VisibilityState>> = {};
  for (const sectionId of sectionIds) {
    const config = rules.sections[sectionId];
    grid[sectionId] = {};
    for (const role of ROLES) {
      if (config?.requiredRole) {
        const requiredLevel = ROLE_LEVEL[config.requiredRole] ?? 0;
        const roleLevel = ROLE_LEVEL[role] ?? 0;
        if (roleLevel < requiredLevel) {
          grid[sectionId][role] = "blocked";
          continue;
        }
      }
      if (config?.defaultHiddenFor?.includes(role)) {
        grid[sectionId][role] = "hidden_default";
      } else {
        grid[sectionId][role] = "visible";
      }
    }
  }
  return grid;
}

/**
 * Convert grid back to SidebarVisibilityRules
 */
function gridToRules(
  grid: Record<string, Record<string, VisibilityState>>
): SidebarVisibilityRules {
  const sections: SidebarVisibilityRules["sections"] = {};
  for (const [sectionId, roles] of Object.entries(grid)) {
    // Find the highest role that is blocked — that determines requiredRole
    let requiredRole: string | null = null;
    for (let i = ROLES.length - 1; i >= 0; i--) {
      const role = ROLES[i];
      if (roles[role] === "blocked") {
        // The required role is one level above the highest blocked role
        const blockedLevel = ROLE_LEVEL[role];
        const nextRole = ROLES.find((r) => ROLE_LEVEL[r] === blockedLevel + 1);
        if (nextRole) requiredRole = nextRole;
        break;
      }
    }

    const defaultHiddenFor = ROLES.filter(
      (role) => roles[role] === "hidden_default"
    ) as string[];

    sections[sectionId] = { requiredRole, defaultHiddenFor };
  }
  return { sections };
}

/**
 * Parse a rule string like "ALL:CRUD" into { scope, ops }
 */
function parseRule(rule: string): { scope: string; ops: string[] } {
  if (rule === "NONE" || !rule) return { scope: "NONE", ops: [] };
  const [scope, opsStr] = rule.split(":");
  return { scope, ops: opsStr ? opsStr.split("") : [] };
}

/**
 * Build rule string from scope + ops
 */
function buildRule(scope: string, ops: string[]): string {
  if (scope === "NONE") return "NONE";
  if (ops.length === 0) return "NONE";
  return `${scope}:${ops.join("")}`;
}

// ── Main Component ──────────────────────────────────

export default function AccessControlPage() {
  const [activeTab, setActiveTab] = useState<string>("nav");

  // ── Navigation Visibility state ───────────────────
  const [navRules, setNavRules] = useState<SidebarVisibilityRules | null>(null);
  const [navOriginal, setNavOriginal] = useState<string>("");
  const [navSectionIds, setNavSectionIds] = useState<string[]>([]);
  const [navSectionTitles, setNavSectionTitles] = useState<Record<string, string>>({});
  const [navGrid, setNavGrid] = useState<Record<string, Record<string, VisibilityState>>>({});
  const [navLoading, setNavLoading] = useState(false);
  const [navSaving, setNavSaving] = useState(false);
  const [navError, setNavError] = useState("");
  const [navSuccess, setNavSuccess] = useState("");

  // ── Entity Access state ───────────────────────────
  const [entityContract, setEntityContract] = useState<AccessContract | null>(null);
  const [entityMatrix, setEntityMatrix] = useState<Record<string, Record<string, string>>>({});
  const [entityOriginal, setEntityOriginal] = useState<string>("");
  const [entityLoading, setEntityLoading] = useState(false);
  const [entitySaving, setEntitySaving] = useState(false);
  const [entityError, setEntityError] = useState("");
  const [entitySuccess, setEntitySuccess] = useState("");
  const [editingCell, setEditingCell] = useState<{ entity: string; role: string } | null>(null);
  const [editScope, setEditScope] = useState("ALL");
  const [editOps, setEditOps] = useState<string[]>([]);

  // ── Load sidebar visibility ───────────────────────
  const loadNavRules = useCallback(async () => {
    setNavLoading(true);
    setNavError("");
    try {
      // Load rules + manifest section info
      const [rulesRes, manifestRes] = await Promise.all([
        fetch("/api/admin/access-control/sidebar-visibility"),
        // We also need the section titles from the manifest — piggyback on the rules response
        Promise.resolve(null),
      ]);
      const data = await rulesRes.json();
      if (!data.ok) { setNavError(data.error || "Failed to load"); return; }

      const rules = data.rules as SidebarVisibilityRules;
      const sectionIds = Object.keys(rules.sections);

      setNavRules(rules);
      setNavSectionIds(sectionIds);
      setNavOriginal(JSON.stringify(rules));

      // Build grid
      setNavGrid(rulesToGrid(rules, sectionIds));
    } catch (err: any) {
      setNavError(err.message);
    } finally {
      setNavLoading(false);
    }
  }, []);

  // ── Load entity access ────────────────────────────
  const loadEntityAccess = useCallback(async () => {
    setEntityLoading(true);
    setEntityError("");
    try {
      const res = await fetch("/api/admin/access-control/entity-access");
      const data = await res.json();
      if (!data.ok) { setEntityError(data.error || "Failed to load"); return; }

      setEntityContract(data.contract);
      setEntityMatrix({ ...data.contract.matrix });
      setEntityOriginal(JSON.stringify(data.contract.matrix));
    } catch (err: any) {
      setEntityError(err.message);
    } finally {
      setEntityLoading(false);
    }
  }, []);

  // Lazy-load on tab switch
  useEffect(() => {
    if (activeTab === "nav" && !navRules && !navLoading) loadNavRules();
    if (activeTab === "entity" && !entityContract && !entityLoading) loadEntityAccess();
  }, [activeTab, navRules, navLoading, entityContract, entityLoading, loadNavRules, loadEntityAccess]);

  // Load nav on mount
  useEffect(() => { loadNavRules(); }, [loadNavRules]);

  // ── Nav grid helpers ──────────────────────────────

  const navHasChanges = useMemo(
    () => navOriginal !== JSON.stringify(gridToRules(navGrid)),
    [navOriginal, navGrid]
  );

  const cycleVisibility = (sectionId: string, role: string) => {
    // SUPERADMIN always visible
    if (role === "SUPERADMIN") return;

    const current = navGrid[sectionId]?.[role] || "visible";
    const order: VisibilityState[] = ["visible", "hidden_default", "blocked"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    const next = order[nextIdx];

    setNavGrid((prev) => {
      const updated = { ...prev };
      updated[sectionId] = { ...updated[sectionId], [role]: next };

      // Enforce hierarchy: if this role is blocked, all lower roles must also be blocked
      if (next === "blocked") {
        const roleLevel = ROLE_LEVEL[role];
        for (const r of ROLES) {
          if (ROLE_LEVEL[r] < roleLevel) {
            updated[sectionId][r] = "blocked";
          }
        }
      }

      // Enforce hierarchy: if this role is unblocked, all higher roles must also be unblocked
      if (next !== "blocked") {
        const roleLevel = ROLE_LEVEL[role];
        for (const r of ROLES) {
          if (ROLE_LEVEL[r] > roleLevel && updated[sectionId][r] === "blocked") {
            updated[sectionId][r] = "visible";
          }
        }
      }

      return updated;
    });
  };

  const saveNavRules = async () => {
    setNavSaving(true);
    setNavError("");
    setNavSuccess("");
    try {
      const rules = gridToRules(navGrid);
      const res = await fetch("/api/admin/access-control/sidebar-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!data.ok) { setNavError(data.error || "Failed to save"); return; }
      setNavOriginal(JSON.stringify(rules));
      setNavSuccess("Visibility rules saved. Changes take effect on next page load.");
      setTimeout(() => setNavSuccess(""), 4000);
    } catch (err: any) {
      setNavError(err.message);
    } finally {
      setNavSaving(false);
    }
  };

  // ── Entity grid helpers ───────────────────────────

  const entityHasChanges = useMemo(
    () => entityOriginal !== JSON.stringify(entityMatrix),
    [entityOriginal, entityMatrix]
  );

  const openCellEditor = (entity: string, role: string) => {
    if (role === "SUPERADMIN") return; // Always ALL:CRUD, read-only
    const rule = entityMatrix[entity]?.[role] || "NONE";
    const parsed = parseRule(rule);
    setEditScope(parsed.scope);
    setEditOps(parsed.ops);
    setEditingCell({ entity, role });
  };

  const applyCellEdit = () => {
    if (!editingCell) return;
    const { entity, role } = editingCell;
    const rule = buildRule(editScope, editOps);
    setEntityMatrix((prev) => ({
      ...prev,
      [entity]: { ...prev[entity], [role]: rule },
    }));
    setEditingCell(null);
  };

  const saveEntityAccess = async () => {
    setEntitySaving(true);
    setEntityError("");
    setEntitySuccess("");
    try {
      const res = await fetch("/api/admin/access-control/entity-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix: entityMatrix }),
      });
      const data = await res.json();
      if (!data.ok) { setEntityError(data.error || "Failed to save"); return; }
      setEntityOriginal(JSON.stringify(entityMatrix));
      setEntitySuccess("Entity access matrix saved. Cache refreshes within 30 seconds.");
      setTimeout(() => setEntitySuccess(""), 4000);
    } catch (err: any) {
      setEntityError(err.message);
    } finally {
      setEntitySaving(false);
    }
  };

  const resetEntityAccess = async () => {
    if (!confirm("Reset entity access to seed defaults? This cannot be undone.")) return;
    setEntitySaving(true);
    setEntityError("");
    try {
      const res = await fetch("/api/admin/access-control/entity-access/reset", {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) { setEntityError(data.error || "Failed to reset"); return; }
      // Reload
      setEntityContract(null);
      setEntityOriginal("");
      loadEntityAccess();
      setEntitySuccess("Entity access reset to defaults.");
      setTimeout(() => setEntitySuccess(""), 4000);
    } catch (err: any) {
      setEntityError(err.message);
    } finally {
      setEntitySaving(false);
    }
  };

  // ── Render ────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Shield size={22} strokeWidth={1.5} style={{ color: "var(--accent-primary)" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Access Control
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
          Manage role-based visibility and data permissions
        </p>
      </div>

      {/* Info banner */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
          background: "var(--surface-secondary)", border: "1px solid var(--border-default)",
          borderRadius: 10, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)",
        }}
      >
        <Info size={16} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Navigation</strong> controls what users <em>see</em> in the sidebar.{" "}
          <strong>Entity Access</strong> controls what data they can <em>read and write</em>.{" "}
          Hiding a nav link does <strong>not</strong> restrict API access.
        </span>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex", gap: 4, marginBottom: 24,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Navigation Visibility Tab ────────────── */}
      {activeTab === "nav" && (
        <div
          style={{
            background: "var(--surface-primary)", border: "1px solid var(--border-default)",
            borderRadius: 16, padding: 24,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            Sidebar Section Visibility
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Click a cell to cycle: Visible → Hidden by default → Blocked
          </p>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {VIS_STATES.map((vs) => {
              const Icon = vs.icon;
              return (
                <div key={vs.value} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 5, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: vs.bg, color: vs.color,
                  }}>
                    <Icon size={13} strokeWidth={2.5} />
                  </div>
                  <span style={{ color: "var(--text-muted)" }}>{vs.label}</span>
                </div>
              );
            })}
          </div>

          {navLoading && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>}
          {navError && <p style={{ fontSize: 13, color: "#ef4444" }}>{navError}</p>}
          {navSuccess && <p style={{ fontSize: 13, color: "#22c55e" }}>{navSuccess}</p>}

          {Object.keys(navGrid).length > 0 && (
            <>
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-default)" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 650 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)" }}>
                      <th style={{
                        padding: "10px 14px", textAlign: "left", fontWeight: 600,
                        color: "var(--text-primary)", position: "sticky", left: 0,
                        background: "var(--surface-secondary)", borderRight: "1px solid var(--border-default)",
                      }}>Section</th>
                      {ROLES.map((role) => (
                        <th key={role} style={{
                          padding: "10px 6px", textAlign: "center", fontWeight: 600,
                          color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.05em",
                          minWidth: 80,
                        }}>{role.replace("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {navSectionIds.map((sectionId, idx) => (
                      <tr key={sectionId} style={{
                        background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                      }}>
                        <td style={{
                          padding: "8px 14px", fontWeight: 500, color: "var(--text-primary)",
                          position: "sticky", left: 0, borderRight: "1px solid var(--border-default)",
                          background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                          textTransform: "capitalize",
                        }}>{sectionId}</td>
                        {ROLES.map((role) => {
                          const state = navGrid[sectionId]?.[role] || "visible";
                          const vs = VIS_STATES.find((v) => v.value === state) || VIS_STATES[0];
                          const Icon = vs.icon;
                          const isSuperadmin = role === "SUPERADMIN";
                          // Check if this cell is auto-blocked by hierarchy
                          const isAutoBlocked = !isSuperadmin && state === "blocked" && (() => {
                            // Find if a higher role is explicitly blocked
                            const roleLevel = ROLE_LEVEL[role];
                            for (const r of ROLES) {
                              if (ROLE_LEVEL[r] > roleLevel && navGrid[sectionId]?.[r] === "blocked") {
                                return true;
                              }
                            }
                            return false;
                          })();

                          return (
                            <td key={role} style={{ padding: "4px 6px", textAlign: "center" }}>
                              <button
                                onClick={() => cycleVisibility(sectionId, role)}
                                disabled={isSuperadmin || isAutoBlocked}
                                title={
                                  isSuperadmin ? "SUPERADMIN always has access"
                                    : isAutoBlocked ? "Blocked because a higher role is blocked"
                                    : `Click to change (currently: ${vs.label})`
                                }
                                style={{
                                  width: 32, height: 32, borderRadius: 7, border: "none",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  background: vs.bg, color: vs.color,
                                  cursor: isSuperadmin || isAutoBlocked ? "not-allowed" : "pointer",
                                  opacity: isSuperadmin || isAutoBlocked ? 0.5 : 1,
                                  transition: "all 0.1s ease",
                                }}
                              >
                                <Icon size={14} strokeWidth={2.5} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save bar */}
              {navHasChanges && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
                  marginTop: 16, padding: "12px 16px",
                  background: "var(--surface-secondary)", borderRadius: 10,
                  border: "1px solid var(--border-default)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: "auto" }}>
                    You have unsaved changes
                  </span>
                  <button
                    onClick={() => { if (navRules) setNavGrid(rulesToGrid(navRules, navSectionIds)); }}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-default)",
                      background: "var(--surface-primary)", color: "var(--text-primary)",
                      fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveNavRules}
                    disabled={navSaving}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "none",
                      background: "var(--accent-primary)", color: "white",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      opacity: navSaving ? 0.6 : 1,
                    }}
                  >
                    <Save size={13} /> {navSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Entity Access Tab ────────────────────── */}
      {activeTab === "entity" && (
        <div
          style={{
            background: "var(--surface-primary)", border: "1px solid var(--border-default)",
            borderRadius: 16, padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Entity Access Matrix
            </h2>
            <button
              onClick={resetEntityAccess}
              disabled={entitySaving}
              style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)", color: "var(--text-muted)",
                fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <RotateCcw size={12} /> Reset to Defaults
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Click a cell to edit scope and operations. SUPERADMIN always has full access.
          </p>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { label: "C", desc: "Create", color: "#22c55e" },
              { label: "R", desc: "Read", color: "#3b82f6" },
              { label: "U", desc: "Update", color: "#f59e0b" },
              { label: "D", desc: "Delete", color: "#ef4444" },
            ].map((op) => (
              <div key={op.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: op.color, color: "#fff",
                }}>{op.label}</span>
                <span style={{ color: "var(--text-muted)" }}>{op.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {Object.entries(SCOPE_COLORS).filter(([k]) => k !== "NONE").map(([scope, colors]) => (
              <span key={scope} style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: colors.bg, color: colors.text,
              }}>{scope}</span>
            ))}
          </div>

          {entityLoading && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>}
          {entityError && <p style={{ fontSize: 13, color: "#ef4444" }}>{entityError}</p>}
          {entitySuccess && <p style={{ fontSize: 13, color: "#22c55e" }}>{entitySuccess}</p>}

          {entityContract && Object.keys(entityMatrix).length > 0 && (
            <>
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-default)", position: "relative" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 750 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)" }}>
                      <th style={{
                        padding: "10px 14px", textAlign: "left", fontWeight: 600,
                        color: "var(--text-primary)", position: "sticky", left: 0,
                        background: "var(--surface-secondary)", borderRight: "1px solid var(--border-default)",
                      }}>Entity</th>
                      {ROLES.map((role) => (
                        <th key={role} style={{
                          padding: "10px 6px", textAlign: "center", fontWeight: 600,
                          color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.05em",
                        }}>{role.replace("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(entityMatrix).map(([entity, roleMap], idx) => (
                      <tr key={entity} style={{
                        background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                      }}>
                        <td style={{
                          padding: "8px 14px", fontWeight: 500, color: "var(--text-primary)",
                          position: "sticky", left: 0, borderRight: "1px solid var(--border-default)",
                          background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                        }}>{entity}</td>
                        {ROLES.map((role) => {
                          const rule = roleMap[role] || "NONE";
                          const { scope, ops } = parseRule(rule);
                          const isNone = scope === "NONE";
                          const isSuperadmin = role === "SUPERADMIN";
                          const sc = SCOPE_COLORS[scope] || SCOPE_COLORS.NONE;
                          const isEditing = editingCell?.entity === entity && editingCell?.role === role;
                          const isChanged = entityOriginal && (() => {
                            try {
                              const orig = JSON.parse(entityOriginal);
                              return orig[entity]?.[role] !== rule;
                            } catch { return false; }
                          })();

                          return (
                            <td
                              key={role}
                              style={{
                                padding: "4px 6px", textAlign: "center", position: "relative",
                                cursor: isSuperadmin ? "default" : "pointer",
                                outline: isChanged ? "2px dashed var(--accent-primary)" : "none",
                                outlineOffset: -2,
                              }}
                              onClick={() => !isEditing && openCellEditor(entity, role)}
                            >
                              {isNone ? (
                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <span style={{
                                    padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600,
                                    background: sc.bg, color: sc.text,
                                  }}>{scope}</span>
                                  <div style={{ display: "flex", gap: 1 }}>
                                    {ops.map((op) => (
                                      <span key={op} style={{
                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                        width: 15, height: 15, borderRadius: 3, fontSize: 8, fontWeight: 700,
                                        background: OP_COLORS[op] || "#6b7280", color: "#fff",
                                      }}>{op}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Inline cell editor popover */}
                              {isEditing && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: "absolute", top: "100%", left: "50%",
                                    transform: "translateX(-50%)", zIndex: 50,
                                    background: "var(--surface-primary)", border: "1px solid var(--border-default)",
                                    borderRadius: 10, padding: 12, minWidth: 180,
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                                  }}
                                >
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                                    {entity} / {role}
                                  </div>

                                  {/* Scope selector */}
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Scope</div>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {["ALL", "DOMAIN", "OWN", "NONE"].map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => {
                                            setEditScope(s);
                                            if (s === "NONE") setEditOps([]);
                                          }}
                                          style={{
                                            padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            border: editScope === s ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                                            background: SCOPE_COLORS[s]?.bg || "transparent",
                                            color: SCOPE_COLORS[s]?.text || "var(--text-muted)",
                                            cursor: "pointer",
                                          }}
                                        >{s}</button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* CRUD checkboxes */}
                                  {editScope !== "NONE" && (
                                    <div style={{ marginBottom: 8 }}>
                                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Operations</div>
                                      <div style={{ display: "flex", gap: 6 }}>
                                        {["C", "R", "U", "D"].map((op) => {
                                          const active = editOps.includes(op);
                                          return (
                                            <button
                                              key={op}
                                              onClick={() =>
                                                setEditOps((prev) =>
                                                  active ? prev.filter((o) => o !== op) : [...prev, op]
                                                )
                                              }
                                              style={{
                                                width: 26, height: 26, borderRadius: 5, fontSize: 11, fontWeight: 700,
                                                border: "none", cursor: "pointer",
                                                background: active ? OP_COLORS[op] : "var(--surface-tertiary)",
                                                color: active ? "#fff" : "var(--text-muted)",
                                                transition: "all 0.1s ease",
                                              }}
                                            >{op}</button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Apply/Cancel */}
                                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                    <button
                                      onClick={() => setEditingCell(null)}
                                      style={{
                                        padding: "4px 10px", borderRadius: 5, fontSize: 11,
                                        border: "1px solid var(--border-default)", background: "var(--surface-secondary)",
                                        color: "var(--text-primary)", cursor: "pointer",
                                      }}
                                    >Cancel</button>
                                    <button
                                      onClick={applyCellEdit}
                                      style={{
                                        padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                                        border: "none", background: "var(--accent-primary)", color: "white",
                                        cursor: "pointer",
                                      }}
                                    >Apply</button>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save bar */}
              {entityHasChanges && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
                  marginTop: 16, padding: "12px 16px",
                  background: "var(--surface-secondary)", borderRadius: 10,
                  border: "1px solid var(--border-default)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: "auto" }}>
                    You have unsaved changes
                  </span>
                  <button
                    onClick={() => {
                      if (entityContract) {
                        setEntityMatrix({ ...entityContract.matrix });
                        setEditingCell(null);
                      }
                    }}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-default)",
                      background: "var(--surface-primary)", color: "var(--text-primary)",
                      fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveEntityAccess}
                    disabled={entitySaving}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "none",
                      background: "var(--accent-primary)", color: "white",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      opacity: entitySaving ? 0.6 : 1,
                    }}
                  >
                    <Save size={13} /> {entitySaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

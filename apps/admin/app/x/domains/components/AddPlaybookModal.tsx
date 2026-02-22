"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { StatusBadge } from "@/src/components/shared/EntityPill";
import { playbookStatusMap } from "./constants";
import type { Playbook } from "./types";

interface AddPlaybookModalProps {
  domainId: string;
  domainName: string;
  open: boolean;
  onClose: () => void;
  onPlaybookAdded: () => void;
}

export function AddPlaybookModal({ domainId, domainName, open, onClose, onPlaybookAdded }: AddPlaybookModalProps) {
  const router = useRouter();
  const { terms, plural } = useTerminology();

  // Modal-owned state
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "" });
  const [allPlaybooks, setAllPlaybooks] = useState<Playbook[]>([]);
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
  const [modalTab, setModalTab] = useState<"create" | "existing">("existing");
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);

  // Fetch all playbooks when modal opens
  useEffect(() => {
    if (open) {
      setModalTab("existing");
      setNewPlaybook({ name: "", description: "" });
      setLoadingPlaybooks(true);
      fetch("/api/playbooks")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setAllPlaybooks(data.playbooks || []);
        })
        .finally(() => setLoadingPlaybooks(false));
    }
  }, [open]);

  const playbookStatusBadge = (status: string) => {
    return <StatusBadge status={playbookStatusMap[status] || "draft"} size="compact" />;
  };

  const handleCreatePlaybook = async () => {
    if (!newPlaybook.name || !domainId) {
      alert("Name is required");
      return;
    }

    setCreatingPlaybook(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPlaybook,
          domainId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/x/playbooks/${data.playbook.id}`);
      } else {
        alert("Failed to create playbook: " + data.error);
      }
    } catch (err: any) {
      alert("Error creating playbook: " + err.message);
    } finally {
      setCreatingPlaybook(false);
    }
  };

  const handleMovePlaybook = async (playbookId: string) => {
    setMovingPlaybookId(playbookId);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (data.ok) {
        onClose();
        onPlaybookAdded();
      } else {
        alert("Failed to move playbook: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setMovingPlaybookId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 12,
          width: 500,
          maxWidth: "90%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with Tabs */}
        <div style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ padding: "16px 20px 0 20px" }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Add {terms.playbook} to {domainName}</h2>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            <button
              onClick={() => setModalTab("existing")}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: modalTab === "existing" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                color: modalTab === "existing" ? "var(--accent-primary)" : "var(--text-muted)",
                fontWeight: modalTab === "existing" ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Move Existing
            </button>
            <button
              onClick={() => setModalTab("create")}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: modalTab === "create" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                color: modalTab === "create" ? "var(--accent-primary)" : "var(--text-muted)",
                fontWeight: modalTab === "create" ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Create New
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {modalTab === "existing" ? (
            <div>
              {loadingPlaybooks ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Loading playbooks...</div>
              ) : (() => {
                const otherPlaybooks = allPlaybooks.filter((pb) => pb.domain?.id !== domainId);
                return otherPlaybooks.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                    <p>No {plural("playbook").toLowerCase()} in other {plural("domain").toLowerCase()} to move.</p>
                    <button
                      onClick={() => setModalTab("create")}
                      style={{
                        marginTop: 12,
                        padding: "8px 16px",
                        background: "var(--button-primary-bg)",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Create New Instead
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {otherPlaybooks.map((pb) => (
                      <div
                        key={pb.id}
                        style={{
                          padding: 12,
                          border: "1px solid var(--border-default)",
                          borderRadius: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontWeight: 500, fontSize: 14 }}>{pb.name}</span>
                            {playbookStatusBadge(pb.status)}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            From: {pb.domain?.name || "No institution"} &bull; {pb._count?.items || 0} specs
                          </div>
                        </div>
                        <button
                          onClick={() => handleMovePlaybook(pb.id)}
                          disabled={movingPlaybookId === pb.id}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 500,
                            background: movingPlaybookId === pb.id ? "var(--border-default)" : "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                            color: movingPlaybookId === pb.id ? "var(--text-muted)" : "var(--accent-primary)",
                            border: "none",
                            borderRadius: 6,
                            cursor: movingPlaybookId === pb.id ? "not-allowed" : "pointer",
                          }}
                        >
                          {movingPlaybookId === pb.id ? "Moving..." : "Move Here"}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newPlaybook.name}
                  onChange={(e) => setNewPlaybook({ ...newPlaybook, name: e.target.value })}
                  placeholder="e.g., Default Tutor Playbook"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  value={newPlaybook.description}
                  onChange={(e) => setNewPlaybook({ ...newPlaybook, description: e.target.value })}
                  placeholder="What does this playbook do?"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: 14,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={handleCreatePlaybook}
                disabled={creatingPlaybook || !newPlaybook.name}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: newPlaybook.name ? "var(--accent-primary)" : "var(--border-default)",
                  color: newPlaybook.name ? "var(--button-primary-text, #fff)" : "var(--text-muted)",
                  border: "none",
                  borderRadius: 6,
                  cursor: newPlaybook.name && !creatingPlaybook ? "pointer" : "not-allowed",
                }}
              >
                {creatingPlaybook ? "Creating..." : "Create & Edit"}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-default)", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

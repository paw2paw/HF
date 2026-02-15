"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import type { Ticket, TicketStats, TicketStatus, TicketPriority, TicketCategory, TicketComment } from "@/types/tickets";
import { formatRelativeTime, getUserInitials, getCategoryIcon, truncateText } from "@/utils/formatters";

export default function TicketsPage() {
  const { data: session } = useSession();
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "ALL">("ALL");
  const [filterPriority, setFilterPriority] = useState<TicketPriority | "ALL">("ALL");
  const [filterCategory, setFilterCategory] = useState<TicketCategory | "ALL">("ALL");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterStatus !== "ALL") queryParams.set("status", filterStatus);
  if (filterPriority !== "ALL") queryParams.set("priority", filterPriority);
  if (filterCategory !== "ALL") queryParams.set("category", filterCategory);
  if (filterAssignedToMe && session?.user?.id) queryParams.set("assigneeId", session.user.id);

  // Fetch tickets
  const { data: ticketsData, loading: ticketsLoading, refetch: refetchTickets } = useApi<{
    tickets: Ticket[];
    total: number;
  }>(`/api/tickets${queryParams.toString() ? `?${queryParams.toString()}` : ""}`, {
    transform: (data) => data as unknown as { tickets: Ticket[]; total: number },
  });

  // Fetch stats
  const { data: statsData, refetch: refetchStats } = useApi<{ stats: TicketStats }>("/api/tickets/stats", {
    transform: (data) => data as unknown as { stats: TicketStats },
  });

  const tickets = ticketsData?.tickets || [];
  const stats = statsData?.stats;

  // Filter by search
  const filteredTickets = tickets.filter((ticket) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      ticket.title.toLowerCase().includes(searchLower) ||
      ticket.description.toLowerCase().includes(searchLower) ||
      ticket.ticketNumber.toString().includes(searchLower) ||
      ticket.creator.name?.toLowerCase().includes(searchLower) ||
      ticket.creator.email.toLowerCase().includes(searchLower)
    );
  });

  const refetchAll = () => {
    refetchTickets();
    refetchStats();
  };

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Tickets</h1>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px",
              background: "#8b5cf6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🎫</span>
            New Ticket
          </button>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          Track and manage support requests and issues
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Open"
            count={stats.byStatus.OPEN}
            color="#22c55e"
            onClick={() => setFilterStatus("OPEN")}
            active={filterStatus === "OPEN"}
          />
          <StatCard
            label="In Progress"
            count={stats.byStatus.IN_PROGRESS}
            color="#3b82f6"
            onClick={() => setFilterStatus("IN_PROGRESS")}
            active={filterStatus === "IN_PROGRESS"}
          />
          <StatCard
            label="Waiting"
            count={stats.byStatus.WAITING}
            color="#f59e0b"
            onClick={() => setFilterStatus("WAITING")}
            active={filterStatus === "WAITING"}
          />
          <StatCard
            label="My Assigned"
            count={stats.myAssigned}
            color="#8b5cf6"
            onClick={() => setFilterAssignedToMe(!filterAssignedToMe)}
            active={filterAssignedToMe}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TicketStatus | "ALL")}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING">Waiting</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TicketPriority | "ALL")}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
          }}
        >
          <option value="ALL">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as TicketCategory | "ALL")}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
          }}
        >
          <option value="ALL">All Categories</option>
          <option value="BUG">Bug</option>
          <option value="FEATURE">Feature</option>
          <option value="QUESTION">Question</option>
          <option value="SUPPORT">Support</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Ticket List */}
      {ticketsLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "var(--surface-secondary)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
          <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            {search || filterStatus !== "ALL" || filterPriority !== "ALL" || filterCategory !== "ALL" ? "No tickets match your filters" : "No tickets yet"}
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Create your first ticket to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            refetchAll();
          }}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticketId={selectedTicket.id}
          onClose={() => setSelectedTicket(null)}
          onUpdate={() => {
            setSelectedTicket(null);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  count,
  color,
  onClick,
  active,
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        background: active ? `color-mix(in srgb, ${color} 8%, transparent)` : "var(--surface-primary)",
        border: `2px solid ${active ? color : "var(--border-default)"}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 12px color-mix(in srgb, ${color} 20%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active ? color : "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>{count}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        background: "var(--surface-primary)",
        border: `2px solid ${getPriorityBorderColor(ticket.priority)}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = getPriorityColor(ticket.priority);
        e.currentTarget.style.boxShadow = `0 4px 12px color-mix(in srgb, ${getPriorityColor(ticket.priority)} 20%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = getPriorityBorderColor(ticket.priority);
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>#{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{getCategoryIcon(ticket.category)}</span>
          {ticket._count && ticket._count.comments > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>💬 {ticket._count.comments}</span>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
        {ticket.title}
      </h3>

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
        {truncateText(ticket.description, 150)}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#6b7280",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {getUserInitials(ticket.creator)}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {ticket.creator.name || ticket.creator.email}
            </span>
          </div>
          {ticket.assignee && (
            <>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>→</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {getUserInitials(ticket.assignee)}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {ticket.assignee.name || ticket.assignee.email}
                </span>
              </div>
            </>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatRelativeTime(ticket.createdAt)}</span>
      </div>
    </div>
  );
}

// Badge Components
function StatusBadge({ status }: { status: TicketStatus }) {
  const config = getStatusConfig(status);
  return (
    <span
      style={{
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        borderRadius: 4,
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = getPriorityConfig(priority);
  return (
    <span
      style={{
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
        background: config.bg,
        color: config.text,
        borderRadius: 4,
      }}
    >
      {priority}
    </span>
  );
}

// Helper functions
function getStatusConfig(status: TicketStatus) {
  const configs: Record<TicketStatus, { bg: string; text: string; border: string }> = {
    OPEN: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "color-mix(in srgb, var(--status-success-text) 40%, transparent)" },
    IN_PROGRESS: { bg: "var(--status-info-bg)", text: "var(--status-info-text)", border: "color-mix(in srgb, var(--status-info-text) 40%, transparent)" },
    WAITING: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "color-mix(in srgb, var(--status-warning-text) 40%, transparent)" },
    RESOLVED: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "color-mix(in srgb, var(--status-success-text) 40%, transparent)" },
    CLOSED: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)", border: "color-mix(in srgb, var(--status-neutral-text) 40%, transparent)" },
  };
  return configs[status];
}

function getPriorityConfig(priority: TicketPriority) {
  const configs: Record<TicketPriority, { bg: string; text: string }> = {
    LOW: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
    MEDIUM: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
    HIGH: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
    URGENT: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  };
  return configs[priority];
}

function getPriorityColor(priority: TicketPriority): string {
  const colors: Record<TicketPriority, string> = {
    LOW: "#6b7280",
    MEDIUM: "#3b82f6",
    HIGH: "#f97316",
    URGENT: "#ef4444",
  };
  return colors[priority];
}

function getPriorityBorderColor(priority: TicketPriority): string {
  return priority === "URGENT" || priority === "HIGH" ? getPriorityColor(priority) : "var(--border-default)";
}

// Create Ticket Modal
function CreateTicketModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [assigneeId, setAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch users for assignee dropdown
  const { data: usersData, loading: usersLoading, error: usersError } = useApi<{ users: Array<{ id: string; name: string | null; email: string }> }>("/api/users-list", {
    transform: (data) => data as unknown as { users: Array<{ id: string; name: string | null; email: string }> },
  });

  const users = usersData?.users || [];

  // Debug logging
  React.useEffect(() => {
    console.log("[CreateTicketModal] Users loading:", usersLoading);
    console.log("[CreateTicketModal] Users error:", usersError);
    console.log("[CreateTicketModal] Users data:", usersData);
    console.log("[CreateTicketModal] Users count:", users.length);
  }, [usersData, usersLoading, usersError, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          category,
          assigneeId: assigneeId || null,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to create ticket");
      }

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create ticket";
      console.error("Create ticket error:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
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
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 24, borderBottom: "1px solid var(--border-default)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Create Ticket</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: "var(--status-error-bg)",
                border: "1px solid color-mix(in srgb, var(--status-error-text) 30%, transparent)",
                borderRadius: 6,
                color: "var(--status-error-text)",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Brief summary of the issue"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="Detailed description of the issue"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <option value="BUG">🐛 Bug</option>
                <option value="FEATURE">✨ Feature</option>
                <option value="QUESTION">❓ Question</option>
                <option value="SUPPORT">💬 Support</option>
                <option value="OTHER">📋 Other</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Assign To {usersLoading && "(Loading...)"}
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={usersLoading}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              <option value="">Unassigned</option>
              {usersLoading && <option disabled>Loading users...</option>}
              {usersError && <option disabled>Error loading users</option>}
              {!usersLoading && users.length === 0 && <option disabled>No users found</option>}
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
            {usersError && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>
                Error: {usersError}
              </div>
            )}
            {!usersLoading && !usersError && users.length === 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#f59e0b" }}>
                No users found. Check console for details.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              style={{
                padding: "8px 16px",
                background: loading || !title.trim() || !description.trim() ? "var(--surface-disabled)" : "#8b5cf6",
                color: loading || !title.trim() || !description.trim() ? "var(--text-muted)" : "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !title.trim() || !description.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ticket Detail Modal - Continued in next message due to length...
function TicketDetailModal({
  ticketId,
  onClose,
  onUpdate,
}: {
  ticketId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { data: session } = useSession();
  const [commentContent, setCommentContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: ticketData, loading: ticketLoading, refetch } = useApi<{ ticket: Ticket }>(`/api/tickets/${ticketId}`, {
    transform: (data) => data as unknown as { ticket: Ticket },
  });

  const ticket = ticketData?.ticket;

  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to update status");

      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleUpdatePriority = async (newPriority: TicketPriority) => {
    if (!ticket) return;

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to update priority");

      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update priority");
    }
  };

  const handleUpdateAssignee = async (newAssigneeId: string) => {
    if (!ticket) return;

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: newAssigneeId || null }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to update assignee");

      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update assignee");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !commentContent.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentContent.trim(),
          isInternal,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to add comment");

      setCommentContent("");
      setIsInternal(false);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket || !confirm("Are you sure you want to delete this ticket?")) return;

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete ticket");

      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete ticket");
    }
  };

  // Fetch users for assignee dropdown
  const { data: usersData } = useApi<{ users: Array<{ id: string; name: string | null; email: string }> }>("/api/users-list", {
    transform: (data) => data as unknown as { users: Array<{ id: string; name: string | null; email: string }> },
  });

  const users = usersData?.users || [];

  if (ticketLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div style={{ color: "white", fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
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
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 24,
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                #{ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span style={{ fontSize: 16 }}>{getCategoryIcon(ticket.category)}</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{ticket.title}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(ticket.creatorId === session?.user?.id || session?.user?.role === "ADMIN") && (
              <button
                onClick={handleDelete}
                style={{
                  padding: "6px 12px",
                  background: "var(--status-error-bg)",
                  color: "var(--status-error-text)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: "6px 12px",
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-default)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "var(--text-muted)" }}>
              Status
            </label>
            <select
              value={ticket.status}
              onChange={(e) => handleUpdateStatus(e.target.value as TicketStatus)}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING">Waiting</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "var(--text-muted)" }}>
              Priority
            </label>
            <select
              value={ticket.priority}
              onChange={(e) => handleUpdatePriority(e.target.value as TicketPriority)}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "var(--text-muted)" }}>
              Assignee
            </label>
            <select
              value={ticket.assigneeId || ""}
              onChange={(e) => handleUpdateAssignee(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>
              Description
            </h3>
            <div style={{ fontSize: 14, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {ticket.description}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-muted)" }}>
              Comments ({ticket.comments?.length || 0})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ticket.comments?.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: 12,
                    background: comment.isInternal ? "var(--status-warning-bg)" : "var(--surface-secondary)",
                    border: comment.isInternal ? "1px solid color-mix(in srgb, var(--status-warning-text) 40%, transparent)" : "1px solid var(--border-default)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#6b7280",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {getUserInitials(comment.author)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {comment.author.name || comment.author.email}
                        {comment.isInternal && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              fontWeight: 500,
                              color: "var(--status-warning-text)",
                              background: "color-mix(in srgb, var(--status-warning-text) 25%, transparent)",
                              padding: "2px 6px",
                              borderRadius: 3,
                            }}
                          >
                            Internal
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatRelativeTime(comment.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Comment */}
        <div style={{ padding: 24, borderTop: "1px solid var(--border-default)" }}>
          <form onSubmit={handleAddComment}>
            {error && (
              <div
                style={{
                  padding: 12,
                  background: "#fee2e2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  color: "#991b1b",
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
                resize: "vertical",
                fontFamily: "inherit",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Internal note (team only)</span>
              </label>
              <button
                type="submit"
                disabled={loading || !commentContent.trim()}
                style={{
                  padding: "8px 16px",
                  background: loading || !commentContent.trim() ? "var(--surface-disabled)" : "#8b5cf6",
                  color: loading || !commentContent.trim() ? "var(--text-muted)" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading || !commentContent.trim() ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Adding..." : "Add Comment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

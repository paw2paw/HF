"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import type { Ticket, TicketStats, TicketStatus, TicketPriority, TicketCategory, TicketComment } from "@/types/tickets";
import { formatRelativeTime, getUserInitials, getCategoryIcon, truncateText } from "@/utils/formatters";
import "./tickets.css";

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
    <div className="tk-page">
      {/* Header */}
      <div className="tk-header">
        <div className="tk-header-row">
          <h1 className="hf-page-title">Tickets</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="hf-btn hf-btn-primary tk-create-btn"
          >
            <span>🎫</span>
            New Ticket
          </button>
        </div>
        <p className="tk-subtitle">
          Track and manage support requests and issues
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="tk-stats-grid">
          <StatCard
            label="Open"
            count={stats.byStatus.OPEN}
            color="var(--status-success-text)"
            onClick={() => setFilterStatus("OPEN")}
            active={filterStatus === "OPEN"}
          />
          <StatCard
            label="In Progress"
            count={stats.byStatus.IN_PROGRESS}
            color="var(--accent-primary)"
            onClick={() => setFilterStatus("IN_PROGRESS")}
            active={filterStatus === "IN_PROGRESS"}
          />
          <StatCard
            label="Waiting"
            count={stats.byStatus.WAITING}
            color="var(--status-warning-text)"
            onClick={() => setFilterStatus("WAITING")}
            active={filterStatus === "WAITING"}
          />
          <StatCard
            label="My Assigned"
            count={stats.myAssigned}
            color="var(--accent-secondary, #8b5cf6)"
            onClick={() => setFilterAssignedToMe(!filterAssignedToMe)}
            active={filterAssignedToMe}
          />
        </div>
      )}

      {/* Filters */}
      <div className="tk-filters">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tk-filter-input"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TicketStatus | "ALL")}
          className="tk-filter-select"
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
          className="tk-filter-select"
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
          className="tk-filter-select"
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
        <div className="tk-loading">Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="tk-empty">
          <div className="tk-empty-icon">🎫</div>
          <p className="tk-empty-title">
            {search || filterStatus !== "ALL" || filterPriority !== "ALL" || filterCategory !== "ALL" ? "No tickets match your filters" : "No tickets yet"}
          </p>
          <p className="tk-empty-text">
            Create your first ticket to get started.
          </p>
        </div>
      ) : (
        <div className="tk-list">
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
      className={`tk-stat-card${active ? " active" : ""}`}
      style={{ "--stat-color": color } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 12px color-mix(in srgb, ${color} 20%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active ? color : "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="tk-stat-count">{count}</div>
      <div className="tk-stat-label">{label}</div>
    </div>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="tk-card"
      style={{ borderColor: getPriorityBorderColor(ticket.priority) }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = getPriorityColor(ticket.priority);
        e.currentTarget.style.boxShadow = `0 4px 12px color-mix(in srgb, ${getPriorityColor(ticket.priority)} 20%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = getPriorityBorderColor(ticket.priority);
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="tk-card-header">
        <div className="tk-card-meta">
          <span className="tk-ticket-number">#{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <div className="tk-card-icons">
          <span className="tk-category-icon">{getCategoryIcon(ticket.category)}</span>
          {ticket._count && ticket._count.comments > 0 && (
            <span className="tk-comment-count">💬 {ticket._count.comments}</span>
          )}
        </div>
      </div>

      <h3 className="tk-card-title">
        {ticket.title}
      </h3>

      <p className="tk-card-desc">
        {truncateText(ticket.description, 150)}
      </p>

      <div className="tk-card-footer">
        <div className="tk-card-people">
          <div className="tk-person">
            <div className="tk-avatar">
              {getUserInitials(ticket.creator)}
            </div>
            <span className="tk-person-name">
              {ticket.creator.name || ticket.creator.email}
            </span>
          </div>
          {ticket.assignee && (
            <>
              <span className="tk-arrow">&rarr;</span>
              <div className="tk-person">
                <div className="tk-avatar-accent">
                  {getUserInitials(ticket.assignee)}
                </div>
                <span className="tk-person-name">
                  {ticket.assignee.name || ticket.assignee.email}
                </span>
              </div>
            </>
          )}
        </div>
        <span className="tk-timestamp">{formatRelativeTime(ticket.createdAt)}</span>
      </div>
    </div>
  );
}

// Badge Components
function StatusBadge({ status }: { status: TicketStatus }) {
  const config = getStatusConfig(status);
  return (
    <span
      className="tk-badge-bordered"
      style={{ background: config.bg, color: config.text, borderColor: config.border }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = getPriorityConfig(priority);
  return (
    <span
      className="tk-badge"
      style={{ background: config.bg, color: config.text }}
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
    LOW: "var(--text-muted)",
    MEDIUM: "var(--accent-primary)",
    HIGH: "var(--status-warning-text)",
    URGENT: "var(--status-error-text)",
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
    <div className="tk-modal-overlay" onClick={onClose}>
      <div className="tk-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tk-modal-header">
          <h2 className="tk-modal-title">Create Ticket</h2>
        </div>

        <form onSubmit={handleSubmit} className="tk-form">
          {error && (
            <div className="tk-error-banner">
              {error}
            </div>
          )}

          <div className="tk-field">
            <label className="tk-field-label">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Brief summary of the issue"
              className="tk-text-input"
            />
          </div>

          <div className="tk-field">
            <label className="tk-field-label">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="Detailed description of the issue"
              className="tk-textarea"
            />
          </div>

          <div className="tk-two-col">
            <div>
              <label className="tk-field-label">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="tk-form-select"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="tk-field-label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="tk-form-select"
              >
                <option value="BUG">Bug</option>
                <option value="FEATURE">Feature</option>
                <option value="QUESTION">Question</option>
                <option value="SUPPORT">Support</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="tk-field-lg">
            <label className="tk-field-label">
              Assign To {usersLoading && "(Loading...)"}
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={usersLoading}
              className="tk-form-select"
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
              <div className="tk-field-hint-error">
                Error: {usersError}
              </div>
            )}
            {!usersLoading && !usersError && users.length === 0 && (
              <div className="tk-field-hint-warning">
                No users found. Check console for details.
              </div>
            )}
          </div>

          <div className="tk-form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="tk-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              className="tk-btn-submit"
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
      <div className="tk-modal-overlay">
        <div className="tk-modal-loading-text">Loading...</div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="tk-modal-overlay" onClick={onClose}>
      <div className="tk-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tk-detail-header">
          <div>
            <div className="tk-detail-meta">
              <span className="tk-detail-ticket-number">
                #{ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="tk-detail-category-icon">{getCategoryIcon(ticket.category)}</span>
            </div>
            <h2 className="tk-detail-title">{ticket.title}</h2>
          </div>
          <div className="tk-detail-actions">
            {(ticket.creatorId === session?.user?.id || session?.user?.role === "ADMIN") && (
              <button onClick={handleDelete} className="tk-btn-delete">
                Delete
              </button>
            )}
            <button onClick={onClose} className="tk-btn-close">
              Close
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="tk-controls">
          <div>
            <label className="tk-control-label">Status</label>
            <select
              value={ticket.status}
              onChange={(e) => handleUpdateStatus(e.target.value as TicketStatus)}
              className="tk-control-select"
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING">Waiting</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="tk-control-label">Priority</label>
            <select
              value={ticket.priority}
              onChange={(e) => handleUpdatePriority(e.target.value as TicketPriority)}
              className="tk-control-select"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="tk-control-label">Assignee</label>
            <select
              value={ticket.assigneeId || ""}
              onChange={(e) => handleUpdateAssignee(e.target.value)}
              className="tk-control-select"
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
        <div className="tk-detail-content">
          {/* Description */}
          <div className="tk-description-section">
            <h3 className="tk-section-label">Description</h3>
            <div className="tk-description-text">
              {ticket.description}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="tk-section-label-comments">
              Comments ({ticket.comments?.length || 0})
            </h3>
            <div className="tk-comments-list">
              {ticket.comments?.map((comment) => (
                <div
                  key={comment.id}
                  className={`tk-comment${comment.isInternal ? " internal" : ""}`}
                >
                  <div className="tk-comment-header">
                    <div className="tk-comment-avatar">
                      {getUserInitials(comment.author)}
                    </div>
                    <div>
                      <div className="tk-comment-author">
                        {comment.author.name || comment.author.email}
                        {comment.isInternal && (
                          <span className="tk-internal-tag">Internal</span>
                        )}
                      </div>
                      <div className="tk-comment-time">
                        {formatRelativeTime(comment.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="tk-comment-body">
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Comment */}
        <div className="tk-comment-form">
          <form onSubmit={handleAddComment}>
            {error && (
              <div className="tk-comment-error">
                {error}
              </div>
            )}
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="tk-comment-textarea"
            />
            <div className="tk-comment-footer">
              <label className="tk-checkbox-label">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="tk-checkbox"
                />
                <span className="tk-checkbox-text">Internal note (team only)</span>
              </label>
              <button
                type="submit"
                disabled={loading || !commentContent.trim()}
                className="tk-btn-submit"
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

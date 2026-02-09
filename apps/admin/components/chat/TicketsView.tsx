"use client";

import React, { useState, useEffect } from "react";
import { useChatContext, Ticket, TicketComment } from "@/contexts/ChatContext";
import { FancySelect } from "@/components/shared/FancySelect";

interface User {
  id: string;
  name: string | null;
  email: string;
}

const STATUS_CONFIG = {
  OPEN: { label: "Open", bg: "#dbeafe", color: "#2563eb" },
  IN_PROGRESS: { label: "In Progress", bg: "#fef3c7", color: "#d97706" },
  WAITING: { label: "Waiting", bg: "#f3f4f6", color: "#6b7280" },
  RESOLVED: { label: "Resolved", bg: "#dcfce7", color: "#16a34a" },
  CLOSED: { label: "Closed", bg: "#e5e7eb", color: "#4b5563" },
};

const PRIORITY_CONFIG = {
  LOW: { label: "Low", bg: "#f3f4f6", color: "#6b7280" },
  MEDIUM: { label: "Medium", bg: "#dbeafe", color: "#2563eb" },
  HIGH: { label: "High", bg: "#fef3c7", color: "#d97706" },
  URGENT: { label: "Urgent", bg: "#fef2f2", color: "#dc2626" },
};

const CATEGORY_OPTIONS = [
  { value: "BUG", label: "Bug" },
  { value: "FEATURE", label: "Feature Request" },
  { value: "QUESTION", label: "Question" },
  { value: "SUPPORT", label: "Support" },
  { value: "OTHER", label: "Other" },
];

export function TicketsView() {
  const {
    tickets,
    ticketsLoading,
    selectedTicketId,
    ticketStats,
    fetchTickets,
    selectTicket,
    createTicket,
    updateTicket,
    addTicketComment,
  } = useChatContext();

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<(Ticket & { comments?: TicketComment[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("OTHER");
  const [assigneeId, setAssigneeId] = useState("");
  const [creating, setCreating] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Fetch users for assignee picker
  useEffect(() => {
    if ((showCreate || selectedTicket) && users.length === 0) {
      fetch("/api/admin/users")
        .then(res => res.json())
        .then(data => {
          if (data.users) setUsers(data.users);
        })
        .catch(console.error);
    }
  }, [showCreate, selectedTicket, users.length]);

  // Fetch full ticket detail when selected
  useEffect(() => {
    if (selectedTicketId) {
      setLoadingDetail(true);
      fetch(`/api/tickets/${selectedTicketId}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) setSelectedTicketDetail(data.ticket);
        })
        .catch(console.error)
        .finally(() => setLoadingDetail(false));
    } else {
      setSelectedTicketDetail(null);
    }
  }, [selectedTicketId]);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) return;

    setCreating(true);
    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        assigneeId: assigneeId || undefined,
      });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setCategory("OTHER");
      setAssigneeId("");
    } catch (err) {
      console.error("Failed to create ticket:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await updateTicket(ticketId, { status: newStatus as Ticket["status"] });
      // Refresh detail
      if (selectedTicketId === ticketId) {
        const res = await fetch(`/api/tickets/${ticketId}`);
        const data = await res.json();
        if (data.ok) setSelectedTicketDetail(data.ticket);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicketId || !newComment.trim()) return;

    setAddingComment(true);
    try {
      await addTicketComment(selectedTicketId, newComment.trim());
      setNewComment("");
      // Refresh detail to show new comment
      const res = await fetch(`/api/tickets/${selectedTicketId}`);
      const data = await res.json();
      if (data.ok) setSelectedTicketDetail(data.ticket);
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setAddingComment(false);
    }
  };

  const filteredTickets = statusFilter === "all"
    ? tickets
    : tickets.filter(t => t.status === statusFilter);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-default, #e5e7eb)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-default, #e5e7eb)",
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="all">All ({tickets.length})</option>
            <option value="OPEN">Open ({ticketStats?.open || 0})</option>
            <option value="IN_PROGRESS">In Progress ({ticketStats?.inProgress || 0})</option>
            <option value="WAITING">Waiting</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          {ticketStats && ticketStats.myAssigned > 0 && (
            <span style={{
              fontSize: 11,
              color: "#6b7280",
              background: "#f3f4f6",
              padding: "4px 8px",
              borderRadius: 4,
            }}>
              {ticketStats.myAssigned} assigned to you
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          + New Ticket
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Ticket list */}
        <div style={{
          width: selectedTicket ? "40%" : "100%",
          borderRight: selectedTicket ? "1px solid var(--border-default, #e5e7eb)" : "none",
          overflow: "auto",
        }}>
          {ticketsLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
              No tickets found
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => selectTicket(ticket.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-default, #e5e7eb)",
                  cursor: "pointer",
                  background: ticket.id === selectedTicketId
                    ? "var(--badge-blue-bg, #dbeafe)"
                    : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>#{ticket.ticketNumber}</span>
                    <span style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: PRIORITY_CONFIG[ticket.priority].bg,
                      color: PRIORITY_CONFIG[ticket.priority].color,
                    }}>
                      {PRIORITY_CONFIG[ticket.priority].label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: STATUS_CONFIG[ticket.status].bg,
                    color: STATUS_CONFIG[ticket.status].color,
                  }}>
                    {STATUS_CONFIG[ticket.status].label}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  {ticket.title}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
                  <span>{ticket.creator.name || ticket.creator.email}</span>
                  <span>{formatTime(ticket.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected ticket detail */}
        {selectedTicket && (
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {loadingDetail ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
            ) : selectedTicketDetail ? (
              <>
                <div style={{ padding: 16, borderBottom: "1px solid var(--border-default, #e5e7eb)" }}>
                  <button
                    onClick={() => selectTicket(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#6b7280",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    &larr; Back to list
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                        #{selectedTicketDetail.ticketNumber}
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        {selectedTicketDetail.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status controls */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <select
                      value={selectedTicketDetail.status}
                      onChange={e => handleStatusChange(selectedTicketDetail.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid var(--border-default, #e5e7eb)",
                        fontSize: 12,
                        background: STATUS_CONFIG[selectedTicketDetail.status].bg,
                        color: STATUS_CONFIG[selectedTicketDetail.status].color,
                      }}
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <span style={{
                      fontSize: 10,
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: PRIORITY_CONFIG[selectedTicketDetail.priority].bg,
                      color: PRIORITY_CONFIG[selectedTicketDetail.priority].color,
                    }}>
                      {PRIORITY_CONFIG[selectedTicketDetail.priority].label}
                    </span>
                  </div>

                  {/* Meta info */}
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                    <div>Created by: {selectedTicketDetail.creator.name || selectedTicketDetail.creator.email}</div>
                    {selectedTicketDetail.assignee && (
                      <div>Assigned to: {selectedTicketDetail.assignee.name || selectedTicketDetail.assignee.email}</div>
                    )}
                    <div>Created: {new Date(selectedTicketDetail.createdAt).toLocaleString()}</div>
                  </div>

                  {/* Description */}
                  <div style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: 12,
                    background: "#f9fafb",
                    borderRadius: 6,
                  }}>
                    {selectedTicketDetail.description}
                  </div>
                </div>

                {/* Comments */}
                <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>
                    Comments ({selectedTicketDetail.comments?.length || 0})
                  </h4>

                  {selectedTicketDetail.comments?.map(comment => (
                    <div
                      key={comment.id}
                      style={{
                        padding: 12,
                        background: "#f9fafb",
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                          {comment.author.name || comment.author.email}
                        </span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                        {comment.content}
                      </div>
                    </div>
                  ))}

                  {/* Add comment */}
                  <div style={{ marginTop: 12 }}>
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      style={{
                        width: "100%",
                        padding: 12,
                        border: "1px solid var(--border-default, #e5e7eb)",
                        borderRadius: 6,
                        fontSize: 13,
                        resize: "vertical",
                        marginBottom: 8,
                      }}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "#3b82f6",
                        color: "white",
                        cursor: addingComment ? "wait" : "pointer",
                        fontSize: 13,
                        opacity: (addingComment || !newComment.trim()) ? 0.6 : 1,
                      }}
                    >
                      {addingComment ? "Adding..." : "Add Comment"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Create ticket modal */}
      {showCreate && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: "white",
            borderRadius: 12,
            width: "90%",
            maxWidth: 500,
            maxHeight: "80%",
            overflow: "auto",
            padding: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>New Ticket</h3>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief description of the issue"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detailed description..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: 6,
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-default, #e5e7eb)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-default, #e5e7eb)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Assign to</label>
              <FancySelect
                value={assigneeId}
                onChange={setAssigneeId}
                options={[
                  { value: "", label: "Unassigned" },
                  ...users.map(u => ({
                    value: u.id,
                    label: u.name || u.email,
                    subtitle: u.name ? u.email : undefined,
                  })),
                ]}
                placeholder="Select assignee..."
                searchable
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default, #e5e7eb)",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !description.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#3b82f6",
                  color: "white",
                  cursor: creating ? "wait" : "pointer",
                  fontSize: 13,
                  opacity: (creating || !title.trim() || !description.trim()) ? 0.6 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <div style={{
        padding: "8px 16px",
        borderTop: "1px solid var(--border-default, #e5e7eb)",
        textAlign: "center",
      }}>
        <button
          onClick={() => fetchTickets()}
          disabled={ticketsLoading}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          {ticketsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

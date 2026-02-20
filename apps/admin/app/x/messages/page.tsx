"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import type { Message, MessageType } from "@/types/messages";
import { formatRelativeTime, getUserInitials, truncateText } from "@/utils/formatters";

export default function MessagesPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<MessageType>("inbox");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  // Fetch messages
  const { data: messagesData, loading: messagesLoading, refetch: refetchMessages } = useApi<{
    messages: Message[];
    total: number;
  }>(`/api/messages?type=${tab}&unreadOnly=${unreadOnly}`, {
    transform: (data) => data as unknown as { messages: Message[]; total: number },
  });

  // Fetch unread count
  const { data: unreadData, refetch: refetchUnreadCount } = useApi<{ count: number }>("/api/messages/unread-count", {
    transform: (data) => data as unknown as { count: number },
  });

  const messages = messagesData?.messages || [];
  const unreadCount = unreadData?.count || 0;

  // Filter messages by search
  const filteredMessages = messages.filter((msg) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const sender = msg.sender.name || msg.sender.email;
    const recipient = msg.recipient.name || msg.recipient.email;
    const subject = msg.subject || "";
    const content = msg.content || "";
    return (
      sender.toLowerCase().includes(searchLower) ||
      recipient.toLowerCase().includes(searchLower) ||
      subject.toLowerCase().includes(searchLower) ||
      content.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Inbox
            {tab === "inbox" && unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 12,
                  padding: "4px 10px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--accent-primary)",
                  color: "var(--accent-primary-text)",
                  borderRadius: 12,
                }}
              >
                {unreadCount}
              </span>
            )}
          </h1>
          <button
            onClick={() => setShowCompose(true)}
            style={{
              padding: "10px 20px",
              background: "var(--accent-primary)",
              color: "var(--accent-primary-text)",
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
            <span>✉️</span>
            Compose
          </button>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          {tab === "inbox" ? "Messages you've received" : "Messages you've sent"}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "2px solid var(--border-default)",
        }}
      >
        {(["inbox", "sent"] as MessageType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent-primary)" : "2px solid transparent",
              color: tab === t ? "var(--accent-primary)" : "var(--text-muted)",
              fontWeight: tab === t ? 600 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -2,
            }}
          >
            {t === "inbox" ? "📥 Inbox" : "📤 Sent"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
          }}
        />
        {tab === "inbox" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              cursor: "pointer",
              background: unreadOnly ? "var(--status-info-bg)" : "transparent",
              color: unreadOnly ? "var(--status-info-text)" : "var(--text-primary)",
            }}
          >
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Unread only</span>
          </label>
        )}
      </div>

      {/* Message List */}
      {messagesLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading messages...</div>
      ) : filteredMessages.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "var(--surface-secondary)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            {search || unreadOnly ? "No messages match your filters" : "No messages yet"}
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {tab === "inbox" ? "When someone sends you a message, it will appear here." : "Send your first message to get started."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredMessages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              type={tab}
              currentUserId={session?.user?.id || ""}
              onClick={() => setSelectedMessage(msg)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCompose && (
        <ComposeMessageModal
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            setShowCompose(false);
            refetchMessages();
            refetchUnreadCount();
          }}
        />
      )}

      {selectedMessage && (
        <MessageThreadModal
          messageId={selectedMessage.id}
          onClose={() => setSelectedMessage(null)}
          onUpdate={() => {
            setSelectedMessage(null);
            refetchMessages();
            refetchUnreadCount();
          }}
        />
      )}
    </div>
  );
}

// Message Card Component
function MessageCard({
  message,
  type,
  currentUserId,
  onClick,
}: {
  message: Message;
  type: MessageType;
  currentUserId: string;
  onClick: () => void;
}) {
  const isUnread = type === "inbox" && !message.readAt;
  const otherUser = type === "inbox" ? message.sender : message.recipient;
  const hasReplies = (message._count?.replies || 0) > 0;

  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        background: "var(--surface-primary)",
        border: `2px solid ${isUnread ? "var(--accent-primary)" : "var(--border-default)"}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-primary)";
        e.currentTarget.style.boxShadow = "0 4px 12px color-mix(in srgb, var(--accent-primary) 10%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isUnread ? "var(--accent-primary)" : "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--accent-primary)",
            color: "var(--accent-primary-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {getUserInitials(otherUser)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {otherUser.name || otherUser.email}
              </span>
              {isUnread && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatRelativeTime(message.createdAt)}</span>
          </div>

          {message.subject && (
            <div
              style={{
                fontSize: 13,
                fontWeight: isUnread ? 600 : 500,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {message.subject}
            </div>
          )}

          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.4,
            }}
          >
            {truncateText(message.content, 120)}
          </div>

          {hasReplies && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent-primary)", fontWeight: 500 }}>
              💬 {message._count?.replies} {message._count?.replies === 1 ? "reply" : "replies"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compose Message Modal
function ComposeMessageModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch users for recipient dropdown
  const { data: usersData } = useApi<{ users: Array<{ id: string; name: string | null; email: string }> }>("/api/users-list", {
    transform: (data) => data as unknown as { users: Array<{ id: string; name: string | null; email: string }> },
  });

  const users = usersData?.users || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !content.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          subject: subject.trim() || null,
          content: content.trim(),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
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
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Compose Message</h2>
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
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>To *</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              <option value="">Select recipient...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Optional"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Message *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Type your message..."
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
              disabled={loading || !recipientId || !content.trim()}
              style={{
                padding: "8px 16px",
                background: loading || !recipientId || !content.trim() ? "var(--surface-disabled)" : "var(--accent-primary)",
                color: loading || !recipientId || !content.trim() ? "var(--text-muted)" : "var(--accent-primary-text)",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !recipientId || !content.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Message Thread Modal
function MessageThreadModal({
  messageId,
  onClose,
  onUpdate,
}: {
  messageId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { data: session } = useSession();
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: messageData, loading: messageLoading, refetch } = useApi<{ message: Message }>(`/api/messages/${messageId}`, {
    transform: (data) => data as unknown as { message: Message },
  });

  const message = messageData?.message;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !replyContent.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: message.senderId === session?.user?.id ? message.recipientId : message.senderId,
          subject: message.subject,
          content: replyContent.trim(),
          parentId: message.id,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to send reply");
      }

      setReplyContent("");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!message || !confirm("Are you sure you want to delete this message?")) return;

    try {
      const res = await fetch(`/api/messages/${message.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to delete message");
      }

      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete message");
    }
  };

  if (messageLoading) {
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

  if (!message) return null;

  const allMessages = [message.parent, message, ...(message.replies || [])].filter(Boolean) as Message[];

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
          maxWidth: 700,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: 24,
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{message.subject || "Message Thread"}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {message.senderId === session?.user?.id && (
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

        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {allMessages.map((msg, index) => (
              <div
                key={msg.id}
                style={{
                  padding: 16,
                  background: index === 0 ? "var(--surface-secondary)" : "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                      color: "var(--accent-primary-text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {getUserInitials(msg.sender)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {msg.sender.name || msg.sender.email}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatRelativeTime(msg.createdAt)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, borderTop: "1px solid var(--border-default)" }}>
          <form onSubmit={handleReply}>
            {error && (
              <div
                style={{
                  padding: 12,
                  background: "var(--status-error-bg)",
                  border: "1px solid var(--status-error-border)",
                  borderRadius: 6,
                  color: "var(--status-error-text)",
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={loading || !replyContent.trim()}
                style={{
                  padding: "8px 16px",
                  background: loading || !replyContent.trim() ? "var(--surface-disabled)" : "var(--accent-primary)",
                  color: loading || !replyContent.trim() ? "var(--text-muted)" : "var(--accent-primary-text)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading || !replyContent.trim() ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

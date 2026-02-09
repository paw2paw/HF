"use client";

import React, { useState, useEffect } from "react";
import { useChatContext, InboxMessage } from "@/contexts/ChatContext";
import { FancySelect } from "@/components/shared/FancySelect";

interface User {
  id: string;
  name: string | null;
  email: string;
}

export function InboxView() {
  const {
    inboxMessages,
    inboxLoading,
    selectedMessageId,
    unreadCount,
    fetchInbox,
    selectMessage,
    sendInboxMessage,
  } = useChatContext();

  const [showCompose, setShowCompose] = useState(false);
  const [viewType, setViewType] = useState<"inbox" | "sent">("inbox");
  const [sentMessages, setSentMessages] = useState<InboxMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Compose form state
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);

  const selectedMessage = inboxMessages.find(m => m.id === selectedMessageId) ||
                          sentMessages.find(m => m.id === selectedMessageId);

  // Fetch sent messages when switching to sent view
  useEffect(() => {
    if (viewType === "sent") {
      fetch("/api/messages?type=sent&limit=50")
        .then(res => res.json())
        .then(data => {
          if (data.ok) setSentMessages(data.messages);
        })
        .catch(console.error);
    }
  }, [viewType]);

  // Fetch users for recipient picker
  useEffect(() => {
    if (showCompose && users.length === 0 && !loadingUsers) {
      setLoadingUsers(true);
      fetch("/api/admin/users")
        .then(res => res.json())
        .then(data => {
          if (data.users) setUsers(data.users);
        })
        .catch(console.error)
        .finally(() => setLoadingUsers(false));
    }
  }, [showCompose, users.length, loadingUsers]);

  const handleSend = async () => {
    if (!recipientId || !content.trim()) return;

    setSending(true);
    try {
      await sendInboxMessage(recipientId, content.trim(), subject.trim() || undefined, replyTo?.id);
      setShowCompose(false);
      setRecipientId("");
      setSubject("");
      setContent("");
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (msg: InboxMessage) => {
    setReplyTo(msg);
    setRecipientId(msg.senderId);
    setSubject(`Re: ${msg.subject || "(no subject)"}`);
    setShowCompose(true);
  };

  const displayMessages = viewType === "inbox" ? inboxMessages : sentMessages;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setViewType("inbox")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: viewType === "inbox" ? "var(--badge-blue-bg, #dbeafe)" : "transparent",
              color: viewType === "inbox" ? "var(--badge-blue-text, #2563eb)" : "inherit",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Inbox {unreadCount > 0 && <span style={{
              background: "#ef4444",
              color: "white",
              borderRadius: 10,
              padding: "1px 6px",
              fontSize: 11,
              marginLeft: 4,
            }}>{unreadCount}</span>}
          </button>
          <button
            onClick={() => setViewType("sent")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: viewType === "sent" ? "var(--badge-blue-bg, #dbeafe)" : "transparent",
              color: viewType === "sent" ? "var(--badge-blue-text, #2563eb)" : "inherit",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Sent
          </button>
        </div>
        <button
          onClick={() => { setShowCompose(true); setReplyTo(null); }}
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
          + Compose
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Message list */}
        <div style={{
          width: selectedMessage ? "40%" : "100%",
          borderRight: selectedMessage ? "1px solid var(--border-default, #e5e7eb)" : "none",
          overflow: "auto",
        }}>
          {inboxLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : displayMessages.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
              {viewType === "inbox" ? "No messages yet" : "No sent messages"}
            </div>
          ) : (
            displayMessages.map(msg => (
              <div
                key={msg.id}
                onClick={() => selectMessage(msg.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-default, #e5e7eb)",
                  cursor: "pointer",
                  background: msg.id === selectedMessageId
                    ? "var(--badge-blue-bg, #dbeafe)"
                    : !msg.readAt && viewType === "inbox"
                      ? "rgba(59, 130, 246, 0.05)"
                      : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{
                    fontWeight: !msg.readAt && viewType === "inbox" ? 600 : 400,
                    fontSize: 13,
                  }}>
                    {viewType === "inbox"
                      ? (msg.sender.name || msg.sender.email)
                      : (msg.recipient.name || msg.recipient.email)
                    }
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{formatTime(msg.createdAt)}</span>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: !msg.readAt && viewType === "inbox" ? 500 : 400,
                  color: "#374151",
                  marginBottom: 2,
                }}>
                  {msg.subject || "(no subject)"}
                </div>
                <div style={{
                  fontSize: 12,
                  color: "#6b7280",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {msg.content.slice(0, 80)}...
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected message detail */}
        {selectedMessage && (
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => selectMessage(null)}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {selectedMessage.subject || "(no subject)"}
              </h3>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid var(--border-default, #e5e7eb)",
            }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>
                  {selectedMessage.sender.name || selectedMessage.sender.email}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  To: {selectedMessage.recipient.name || selectedMessage.recipient.email}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {new Date(selectedMessage.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{
              whiteSpace: "pre-wrap",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 16,
            }}>
              {selectedMessage.content}
            </div>

            <button
              onClick={() => handleReply(selectedMessage)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--border-default, #e5e7eb)",
                background: "white",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Reply
            </button>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
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
              <h3 style={{ margin: 0 }}>{replyTo ? "Reply" : "New Message"}</h3>
              <button
                onClick={() => { setShowCompose(false); setReplyTo(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>To</label>
              {replyTo ? (
                <div style={{ padding: "8px 12px", background: "#f3f4f6", borderRadius: 6, fontSize: 13 }}>
                  {replyTo.sender.name || replyTo.sender.email}
                </div>
              ) : (
                <FancySelect
                  value={recipientId}
                  onChange={setRecipientId}
                  options={users.map(u => ({
                    value: u.id,
                    label: u.name || u.email,
                    subtitle: u.name ? u.email : undefined,
                  }))}
                  placeholder="Select recipient..."
                  searchable
                />
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject (optional)"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Message</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your message..."
                rows={6}
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => { setShowCompose(false); setReplyTo(null); }}
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
                onClick={handleSend}
                disabled={sending || !recipientId || !content.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#3b82f6",
                  color: "white",
                  cursor: sending ? "wait" : "pointer",
                  fontSize: 13,
                  opacity: (sending || !recipientId || !content.trim()) ? 0.6 : 1,
                }}
              >
                {sending ? "Sending..." : "Send"}
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
          onClick={() => fetchInbox()}
          disabled={inboxLoading}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          {inboxLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

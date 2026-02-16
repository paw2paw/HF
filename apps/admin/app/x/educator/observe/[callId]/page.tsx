"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface ObserveMessage {
  id: string;
  role: "user" | "assistant" | "teacher";
  content: string;
  senderName?: string;
  createdAt: string;
}

interface CallInfo {
  studentName: string;
  classroom: string;
}

export default function ObserveCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<ObserveMessage[]>([]);
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interjectText, setInterjectText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTimestamp = useRef<string>(new Date(0).toISOString());

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load call info and initial messages
  useEffect(() => {
    async function init() {
      try {
        // Get call info (uses the existing call detail endpoint)
        const callRes = await fetch(`/api/calls/${callId}`);
        const callData = await callRes.json();
        if (callData.ok && callData.call?.caller) {
          setCallInfo({
            studentName: callData.call.caller.name || "Student",
            classroom: "",
          });
        }

        // Load existing messages
        const msgRes = await fetch(`/api/calls/${callId}/messages`);
        const msgData = await msgRes.json();
        if (msgData.ok) {
          setMessages(msgData.messages);
          setCallEnded(msgData.callEnded);
          if (msgData.messages.length > 0) {
            lastTimestamp.current =
              msgData.messages[msgData.messages.length - 1].createdAt;
          }
        }
      } catch {
        // Error loading
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [callId]);

  // Poll for new messages
  useEffect(() => {
    if (callEnded) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/calls/${callId}/messages?after=${lastTimestamp.current}`
        );
        const data = await res.json();
        if (data.ok) {
          if (data.messages.length > 0) {
            setMessages((prev) => [...prev, ...data.messages]);
            lastTimestamp.current =
              data.messages[data.messages.length - 1].createdAt;
          }
          if (data.callEnded) {
            setCallEnded(true);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [callId, callEnded]);

  // Send interjection
  const handleInterject = useCallback(async () => {
    if (!interjectText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/calls/${callId}/interject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: interjectText.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setInterjectText("");
        // The message will appear via polling, but add it immediately for responsiveness
        setMessages((prev) => [
          ...prev,
          {
            id: data.message.id,
            role: "teacher",
            content: data.message.content,
            senderName: data.message.senderName,
            createdAt: data.message.createdAt,
          },
        ]);
      }
    } catch {
      // Error sending
    } finally {
      setSending(false);
    }
  }, [callId, interjectText, sending]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>
          Connecting to call...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/x/educator/students")}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "4px 8px",
            }}
          >
            &larr;
          </button>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {callInfo?.studentName || "Student"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Observing call
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: callEnded ? "var(--text-muted)" : "var(--status-success-text)",
          }}
        >
          {!callEnded && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--status-success-text)",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
          )}
          {callEnded ? "Call Ended" : "Live"}
        </div>
      </div>

      {/* Transcript */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Waiting for messages...
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isTeacher = msg.role === "teacher";
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser
                  ? "flex-end"
                  : isTeacher
                    ? "center"
                    : "flex-start",
                maxWidth: isTeacher ? "85%" : "75%",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 14,
                lineHeight: 1.4,
                ...(isTeacher
                  ? {
                      background: "var(--status-warning-bg)",
                      border: "1px solid var(--status-warning-border)",
                    }
                  : isUser
                    ? {
                        background: "var(--status-success-bg)",
                        color: "var(--text-primary)",
                      }
                    : {
                        background: "var(--surface-primary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }),
              }}
            >
              {isTeacher && msg.senderName && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--status-warning-text)",
                    marginBottom: 2,
                  }}
                >
                  {msg.senderName}
                </div>
              )}
              <div>{msg.content}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          );
        })}

        {callEnded && (
          <div
            style={{
              textAlign: "center",
              padding: "12px 20px",
              margin: "8px 0",
              background: "var(--surface-secondary)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Call has ended
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interject Panel */}
      {!callEnded && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 20px",
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
          }}
        >
          <input
            type="text"
            placeholder="Send a message to the student..."
            value={interjectText}
            onChange={(e) => setInterjectText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInterject()}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleInterject}
            disabled={sending || !interjectText.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--status-warning-text)",
              color: "var(--accent-primary-text)",
              fontSize: 14,
              fontWeight: 600,
              cursor: sending ? "wait" : "pointer",
              opacity: sending || !interjectText.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>
      )}

      {/* Pulse animation for live indicator */}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import type { Ticket, TicketCategory } from "@/types/tickets";
import { formatRelativeTime, getCategoryIcon } from "@/utils/formatters";
import { FeedbackSubmitModal } from "@/components/feedback/FeedbackSubmitModal";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "New",
  WAITING: "Accepted",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Done",
  CLOSED: "Declined",
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-default)",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
    margin: 0,
  },
  newBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent-primary)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px 0",
  },
  row: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "12px 20px",
    cursor: "pointer",
    borderBottom: "1px solid var(--border-default)",
    transition: "background 0.15s",
  },
  rowTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  number: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  titleText: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  meta: {
    fontSize: 12,
    color: "var(--text-muted)",
    paddingLeft: 24,
  },
  expanded: {
    padding: "8px 20px 16px 44px",
    fontSize: 13,
    color: "var(--text-primary)",
    lineHeight: 1.5,
    borderBottom: "1px solid var(--border-default)",
    background: "var(--surface-secondary)",
  },
  comment: {
    marginTop: 8,
    padding: "8px 12px",
    borderRadius: 8,
    background: "var(--surface-primary)",
    fontSize: 12,
    color: "var(--text-muted)",
  },
  commentAuthor: {
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "var(--text-muted)",
    fontSize: 14,
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "var(--text-muted)",
    fontSize: 14,
  },
};

export default function SimFeedbackPage(): React.ReactElement {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: tickets, loading, refetch } = useApi<Ticket[]>(
    userId ? `/api/tickets?creatorId=${userId}&limit=50` : null,
    {
      skip: !userId,
      transform: (res) => res.tickets ?? [],
    },
  );

  // Fetch full ticket when expanded (to get comments)
  const [detail, setDetail] = useState<Ticket | null>(null);

  function handleToggle(id: string): void {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    fetch(`/api/tickets/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setDetail(d.ticket);
      });
  }

  function handleSubmitSuccess(_ticketNumber: number): void {
    setModalOpen(false);
    void refetch();
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>My Feedback</h1>
        <button style={styles.newBtn} onClick={() => setModalOpen(true)}>
          + New
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : !tickets?.length ? (
        <div style={styles.empty}>No feedback yet</div>
      ) : (
        <div style={styles.list}>
          {tickets.map((t) => (
            <div key={t.id}>
              <div
                style={{
                  ...styles.row,
                  background:
                    expandedId === t.id
                      ? "var(--surface-secondary)"
                      : "transparent",
                }}
                onClick={() => handleToggle(t.id)}
              >
                <div style={styles.rowTop}>
                  <span style={styles.icon}>
                    {getCategoryIcon(t.category)}
                  </span>
                  <span style={styles.number}>#{t.ticketNumber}</span>
                  <span style={styles.titleText}>{t.title}</span>
                </div>
                <div style={styles.meta}>
                  {STATUS_LABELS[t.status] ?? t.status}
                  {" · "}
                  {formatRelativeTime(t.createdAt)}
                </div>
              </div>

              {expandedId === t.id && (
                <div style={styles.expanded}>
                  <p style={{ margin: 0 }}>{t.description || "No description."}</p>
                  {detail?.comments?.map((c) => (
                    <div key={c.id} style={styles.comment}>
                      <span style={styles.commentAuthor}>
                        {c.author?.name ?? "Team"}
                      </span>
                      {" — "}
                      {c.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FeedbackSubmitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSubmitSuccess}
      />
    </div>
  );
}

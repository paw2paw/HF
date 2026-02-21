'use client';

interface Action {
  id: string;
  type: string;
  title: string;
  description: string | null;
  assignee: string;
  priority: string;
  status: string;
  source: string;
  confidence: number;
  dueAt: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  SEND_MEDIA: { icon: '\u{1F4E4}', label: 'Send Media' },
  HOMEWORK: { icon: '\u{1F4DA}', label: 'Homework' },
  TASK: { icon: '\u{2705}', label: 'Task' },
  FOLLOWUP: { icon: '\u{27A1}\u{FE0F}', label: 'Follow Up' },
  REMINDER: { icon: '\u{1F514}', label: 'Reminder' },
};

const ASSIGNEE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CALLER: { label: 'Learner', color: '#2E7D32', bg: '#E8F5E9' },
  OPERATOR: { label: 'Operator', color: '#E65100', bg: '#FFF3E0' },
  AGENT: { label: 'Agent', color: '#283593', bg: '#E8EAF6' },
};

export function ActionCard({ action }: { action: Action }) {
  const typeInfo = TYPE_CONFIG[action.type] || { icon: '\u{1F4CB}', label: action.type };
  const assignee = ASSIGNEE_CONFIG[action.assignee] || ASSIGNEE_CONFIG.CALLER;
  const time = new Date(action.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dueStr = action.dueAt
    ? new Date(action.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  const isHighPriority = action.priority === 'HIGH' || action.priority === 'URGENT';

  return (
    <div
      style={{
        alignSelf: 'center',
        width: '90%',
        maxWidth: 400,
        background: 'var(--surface-primary)',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        marginTop: 4,
        marginBottom: 4,
        borderLeft: `3px solid ${assignee.color}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'var(--surface-secondary)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>{typeInfo.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          {typeInfo.label}
        </span>
        <span
          style={{
            background: assignee.bg,
            color: assignee.color,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {assignee.label}
        </span>
        {isHighPriority && (
          <span
            style={{
              background: 'var(--status-error-bg)',
              color: 'var(--status-error-text)',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {action.priority}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {action.title}
        </div>
        {action.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {action.description}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {time}
            {dueStr && ` \u00B7 due ${dueStr}`}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--surface-secondary)',
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            {action.source === 'EXTRACTED' ? 'AI Extracted' : 'Manual'}
          </span>
        </div>
      </div>
    </div>
  );
}

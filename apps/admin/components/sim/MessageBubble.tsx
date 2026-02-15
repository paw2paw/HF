'use client';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'teacher';
  content: string;
  timestamp?: Date;
  senderName?: string;
}

export function MessageBubble({ role, content, timestamp, senderName }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isTeacher = role === 'teacher';
  const timeStr = timestamp
    ? timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  if (isTeacher) {
    return (
      <div className="wa-bubble wa-bubble-teacher">
        <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', marginBottom: 2 }}>
          {senderName || 'Teacher'}
        </div>
        <span>{content}</span>
        {timeStr && <span className="wa-bubble-time">{timeStr}</span>}
      </div>
    );
  }

  return (
    <div className={`wa-bubble ${isUser ? 'wa-bubble-out' : 'wa-bubble-in'}`}>
      <span>{content}</span>
      {timeStr && <span className="wa-bubble-time">{timeStr}</span>}
    </div>
  );
}

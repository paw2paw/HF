'use client';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';
  const timeStr = timestamp
    ? timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className={`wa-bubble ${isUser ? 'wa-bubble-out' : 'wa-bubble-in'}`}>
      <span>{content}</span>
      {timeStr && <span className="wa-bubble-time">{timeStr}</span>}
    </div>
  );
}

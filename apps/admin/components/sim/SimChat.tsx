'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WhatsAppHeader } from './WhatsAppHeader';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';
import { ArtifactCard } from './ArtifactCard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SimChatProps {
  callerId: string;
  callerName: string;
  domainName?: string;
  pastCalls?: { transcript: string; createdAt: string }[];
  mode: 'standalone' | 'embedded';
  onCallEnd?: () => void;
  onBack?: () => void;
}

const AVATAR_COLORS = [
  '#6B7B8D', '#E06B56', '#7C6BC4', '#3D9970', '#D4A843',
  '#4A90D9', '#C45BAA', '#5B8C5A', '#D97B4A', '#8B5E83',
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function parseTranscript(transcript: string): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  const lines = transcript.split('\n');
  let current: { role: 'user' | 'assistant'; content: string } | null = null;
  for (const line of lines) {
    if (line.startsWith('User: ')) {
      if (current) messages.push(current);
      current = { role: 'user', content: line.slice(6) };
    } else if (line.startsWith('Assistant: ')) {
      if (current) messages.push(current);
      current = { role: 'assistant', content: line.slice(11) };
    } else if (current) {
      current.content += '\n' + line;
    }
  }
  if (current) messages.push(current);
  return messages;
}

function formatDateChip(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - target.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (now.getFullYear() !== date.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface HistoryGroup {
  dateLabel: string;
  messages: Message[];
}

export function SimChat({
  callerId,
  callerName,
  domainName,
  pastCalls,
  mode,
  onCallEnd,
  onBack,
}: SimChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [showEndSheet, setShowEndSheet] = useState(false);
  const [runPipeline, setRunPipeline] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Parse past calls into grouped history (computed once)
  const historyGroups: HistoryGroup[] = useMemo(() => {
    if (!pastCalls?.length) return [];
    const groups: HistoryGroup[] = [];
    let lastLabel = '';
    for (const call of pastCalls) {
      const parsed = parseTranscript(call.transcript);
      if (parsed.length === 0) continue;
      const callDate = new Date(call.createdAt);
      const label = formatDateChip(callDate);
      const msgs: Message[] = parsed.map((m, i) => ({
        id: `history-${call.createdAt}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: callDate,
      }));
      if (label === lastLabel && groups.length > 0) {
        // Same date — merge into existing group with a separator
        groups[groups.length - 1].messages.push(...msgs);
      } else {
        groups.push({ dateLabel: label, messages: msgs });
        lastLabel = label;
      }
    }
    return groups;
  }, [pastCalls]);

  const hasHistory = historyGroups.length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, artifacts]);

  // Show toast then auto-hide
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Initialize: compose prompt, create call, AI greets
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Compose a fresh prompt for this caller
        let usedPromptId: string | null = null;
        const composeRes = await fetch(`/api/callers/${callerId}/compose-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ triggerType: 'sim' }),
        });
        if (composeRes.ok) {
          const composeData = await composeRes.json();
          usedPromptId = composeData.prompt?.id || null;
        } else {
          console.warn('[sim] compose-prompt failed, continuing with existing prompt');
        }

        // Create a new call record, linked to the composed prompt
        const callRes = await fetch(`/api/callers/${callerId}/calls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'sim', usedPromptId }),
        });
        const callData = await callRes.json();
        if (!cancelled && callData.ok) {
          console.log('[sim] Call created:', callData.call.id);
          setCallId(callData.call.id);
        } else if (!cancelled) {
          console.error('[sim] Failed to create call:', callData.error || callRes.status);
          setError('Failed to create call record');
          return;
        }

        // AI sends greeting
        if (!cancelled) {
          await streamAIResponse(
            'The user just opened the chat. Greet them warmly as if answering a phone call. Be brief and natural.',
            []
          );
        }
      } catch {
        if (!cancelled) setError('Failed to start conversation');
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callerId]);

  // Stream AI response
  async function streamAIResponse(
    message: string,
    history: { role: string; content: string }[]
  ) {
    setIsStreaming(true);
    setError(null);

    const assistantMsgId = `msg-${Date.now()}-ai`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode: 'CALL',
          entityContext: [
            { type: 'caller', id: callerId, label: callerName },
          ],
          conversationHistory: history.slice(-10),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'AI response failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: fullContent }
              : m
          )
        );
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: m.content || '(Failed to get response)' }
            : m
        )
      );
      setError(e.message || 'Failed to get AI response');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  // Send user message
  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    const history = updatedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    streamAIResponse(input.trim(), history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isStreaming, messages]);

  // End call
  const handleEndCall = useCallback(async () => {
    setIsEnding(true);

    try {
      // Build transcript from messages
      const transcript = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      if (!callId) {
        console.error('[sim] No callId — call record was never created');
        showToast('Error: call was not created');
        setIsEnding(false);
        return;
      }

      console.log('[sim] Saving transcript to call:', callId, `(${transcript.length} chars)`);

      // Save transcript to call record
      const patchRes = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!patchRes.ok) {
        console.error('[sim] Failed to save transcript:', await patchRes.text());
        showToast('Failed to save transcript');
        setIsEnding(false);
        return;
      }

      console.log('[sim] Transcript saved successfully');

      // Fire pipeline async — don't block the UI
      if (runPipeline) {
        console.log('[sim] Starting pipeline (mode: prompt, engine: claude)');
        fetch(`/api/calls/${callId}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerId,
            mode: 'prompt',
            engine: 'claude',
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (!data.ok) console.error('[sim] Pipeline failed:', data.error, data.logs);
            else {
              console.log('[sim] Pipeline complete:', data.message);
              // Fetch artifacts after pipeline completes
              fetch(`/api/callers/${callerId}/artifacts?callId=${callId}`)
                .then(r => r.json())
                .then(d => {
                  if (d.ok && d.artifacts?.length > 0) {
                    setArtifacts(d.artifacts);
                    showToast(`${d.artifacts.length} artifact${d.artifacts.length > 1 ? 's' : ''} shared`);
                  }
                })
                .catch(() => {});
            }
          })
          .catch(e => console.error('[sim] Pipeline error:', e));
      }

      showToast(runPipeline ? 'Call saved — analysis running in background' : 'Call saved');

      // Notify parent (refresh data, etc.)
      onCallEnd?.();

      // Standalone mode with no pipeline: navigate back
      if (!runPipeline && onBack) {
        setTimeout(() => onBack(), 1000);
      }
    } catch {
      showToast('Failed to save call');
      setIsEnding(false);
    }
  }, [callId, callerId, messages, runPipeline, showToast, onCallEnd, onBack]);

  const isEmbedded = mode === 'embedded';

  const content = (
    <>
      {/* Header */}
      <WhatsAppHeader
        title={callerName}
        subtitle={domainName}
        onBack={onBack}
        onEndCall={() => setShowEndSheet(true)}
        callActive={messages.length > 0}
        avatarColor={hashColor(callerId)}
      />

      {/* Messages */}
      <div
        className="wa-chat-bg"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 12px 12px',
        }}
      >
        {/* History — past calls grouped by date */}
        {historyGroups.map((group, gi) => (
          <div key={`hg-${gi}`}>
            <div style={{
              alignSelf: 'center',
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 12px',
              borderRadius: 8,
              fontSize: 12,
              color: '#667781',
              margin: '8px 0',
              boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)',
              textAlign: 'center',
              width: 'fit-content',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              {group.dateLabel}
            </div>
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
          </div>
        ))}

        {/* Separator between history and live session */}
        {hasHistory && (
          <div style={{
            alignSelf: 'center',
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: '#667781',
            margin: '12px 0 8px',
            boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)',
            textAlign: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            New conversation
          </div>
        )}

        {/* Live session date chip */}
        {!hasHistory && (
          <div style={{
            alignSelf: 'center',
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: '#667781',
            margin: '8px 0',
            boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)',
            textAlign: 'center',
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Today
          </div>
        )}

        {/* Live session messages */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}

        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <TypingIndicator />
        )}

        {/* Artifacts — appear after pipeline processes the call */}
        {artifacts.length > 0 && (
          <>
            <div style={{
              alignSelf: 'center',
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 12px',
              borderRadius: 8,
              fontSize: 12,
              color: '#667781',
              margin: '12px 0 4px',
              boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)',
            }}>
              Shared after call
            </div>
            {artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
            ))}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#FFF3E0',
          padding: '8px 16px',
          fontSize: 13,
          color: '#E65100',
          borderTop: '1px solid #FFE0B2',
        }}>
          {error}
        </div>
      )}

      {/* Input */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isStreaming}
      />

      {/* End call confirmation sheet */}
      {showEndSheet && (
        <>
          <div className="wa-sheet-overlay" onClick={() => !isEnding && setShowEndSheet(false)} />
          <div className="wa-sheet">
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111B21', margin: '0 0 16px' }}>
              End this call?
            </h3>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderTop: '1px solid #E9EDEF',
              borderBottom: '1px solid #E9EDEF',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#111B21' }}>Run analysis pipeline</div>
                <div style={{ fontSize: 13, color: '#667781', marginTop: 2 }}>
                  Extract memories, measure traits, adapt targets
                </div>
              </div>
              <button
                className={`wa-toggle ${runPipeline ? 'active' : ''}`}
                onClick={() => setRunPipeline(!runPipeline)}
                disabled={isEnding}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowEndSheet(false)}
                disabled={isEnding}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #D1D7DB',
                  background: 'white',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: '#111B21',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEndCall}
                disabled={isEnding}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 8,
                  border: 'none',
                  background: '#E53935',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isEnding ? 'Saving...' : 'End Call'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className="wa-toast">{toast}</div>}
    </>
  );

  if (isEmbedded) {
    return <div className="sim-embedded">{content}</div>;
  }

  // Standalone: rendered inside sim layout (which provides the container)
  return content;
}

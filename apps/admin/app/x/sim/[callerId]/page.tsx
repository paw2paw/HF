'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResponsive } from '@/hooks/useResponsive';
import { WhatsAppHeader } from '@/components/sim/WhatsAppHeader';
import { MessageBubble } from '@/components/sim/MessageBubble';
import { TypingIndicator } from '@/components/sim/TypingIndicator';
import { MessageInput } from '@/components/sim/MessageInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CallerInfo {
  id: string;
  name: string;
  domain?: { name: string; slug: string } | null;
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

export default function SimConversationPage() {
  const router = useRouter();
  const { callerId } = useParams<{ callerId: string }>();
  const { isDesktop } = useResponsive();

  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [showEndSheet, setShowEndSheet] = useState(false);
  const [runPipeline, setRunPipeline] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Show toast then auto-hide
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Initialize: fetch caller info, compose prompt, create call, AI greets
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Fetch caller info
        const callerRes = await fetch(`/api/callers/${callerId}`);
        const callerData = await callerRes.json();
        if (!callerRes.ok || !callerData.ok) {
          setError('Caller not found');
          return;
        }
        const callerInfo: CallerInfo = {
          id: callerData.caller.id,
          name: callerData.caller.name || 'Unknown',
          domain: callerData.caller.domain,
        };
        if (!cancelled) setCaller(callerInfo);

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
          body: JSON.stringify({ source: 'whatsapp-sim', usedPromptId }),
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
            [],
            callerInfo
          );
        }
      } catch (e) {
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
    history: { role: string; content: string }[],
    callerInfo?: CallerInfo
  ) {
    const info = callerInfo || caller;
    if (!info) return;

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
            { type: 'caller', id: info.id, label: info.name },
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

    // Build conversation history for the AI
    const history = updatedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    streamAIResponse(input.trim(), history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isStreaming, messages, caller]);

  // End call
  const handleEndCall = useCallback(async () => {
    setIsEnding(true);

    try {
      // Build transcript from messages
      const transcript = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      // Guard: callId must exist (created during init)
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
      // mode: 'prompt' runs all stages INCLUDING compose (generates prompt for next call)
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
            else console.log('[sim] Pipeline complete:', data.message);
          })
          .catch(e => console.error('[sim] Pipeline error:', e));
      }

      showToast(runPipeline ? 'Call saved — analysis running in background' : 'Call saved');
      setTimeout(() => router.push('/x/sim'), 1000);
    } catch {
      showToast('Failed to save call');
      setIsEnding(false);
    }
  }, [callId, callerId, messages, runPipeline, router, showToast]);

  if (error && !caller) {
    return (
      <>
        <WhatsAppHeader title="Error" onBack={isDesktop ? undefined : () => router.push('/x/sim')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p style={{ color: '#667781', textAlign: 'center' }}>{error}</p>
        </div>
      </>
    );
  }

  if (!caller) {
    return (
      <>
        <WhatsAppHeader title="Loading..." />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#667781' }}>Starting conversation...</p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <WhatsAppHeader
        title={caller.name}
        subtitle={caller.domain?.name || undefined}
        onBack={isDesktop ? undefined : () => router.push('/x/sim')}
        onEndCall={() => setShowEndSheet(true)}
        callActive={messages.length > 0}
        avatarColor={hashColor(caller.id)}
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
        {/* Date chip */}
        <div style={{
          alignSelf: 'center',
          background: 'rgba(255,255,255,0.9)',
          padding: '4px 12px',
          borderRadius: 8,
          fontSize: 12,
          color: '#667781',
          margin: '8px 0',
          boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)',
        }}>
          Today
        </div>

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
}

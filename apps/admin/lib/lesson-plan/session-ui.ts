/**
 * Shared session type visual configuration.
 * Used by course detail page and session detail page.
 */

import {
  Sparkles, BookOpen, Layers, RotateCcw, Target, CheckCircle,
} from 'lucide-react';

export const SESSION_TYPES = [
  { value: 'onboarding', label: 'Onboarding', color: 'var(--accent-primary)' },
  { value: 'introduce', label: 'Introduce', color: 'var(--status-info-text)' },
  { value: 'deepen', label: 'Deepen', color: 'var(--status-info-text)' },
  { value: 'review', label: 'Review', color: 'var(--status-warning-text)' },
  { value: 'assess', label: 'Assess', color: 'var(--status-error-text)' },
  { value: 'consolidate', label: 'Consolidate', color: 'var(--status-success-text)' },
] as const;

export const SESSION_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  onboarding: Sparkles,
  introduce: BookOpen,
  deepen: Layers,
  review: RotateCcw,
  assess: Target,
  consolidate: CheckCircle,
};

export function getSessionTypeColor(type: string): string {
  return SESSION_TYPES.find((t) => t.value === type)?.color || 'var(--text-muted)';
}

export function getSessionTypeLabel(type: string): string {
  return SESSION_TYPES.find((t) => t.value === type)?.label || type;
}

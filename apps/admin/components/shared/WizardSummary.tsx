'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────

export interface WizardIntentItem {
  icon?: ReactNode;
  label: string;
  value: string;
}

export interface WizardEntity {
  icon: ReactNode;
  label: string;
  name: string;
  detail?: string;
  href?: string;
}

export interface WizardStat {
  label: string;
  value: string | number;
}

export interface WizardAction {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

export interface WizardSummaryProps {
  /** Success heading */
  title: string;
  /** Optional subheading */
  subtitle?: string;

  /** What the user asked for — original intent */
  intent?: { items: WizardIntentItem[] };

  /** What was created — entity cards with optional links */
  created?: { entities: WizardEntity[] };

  /** Key metrics bar */
  stats?: WizardStat[];

  /** AI tuning summary — trait pills + param count */
  tuning?: { traits: string[]; paramCount: number };

  /** Primary CTA */
  primaryAction: WizardAction;
  /** Secondary actions (back, view, etc.) */
  secondaryActions?: WizardAction[];
  /** Optional back button handler */
  onBack?: () => void;

  /** Extra content rendered below sections, above actions */
  children?: ReactNode;
}

// ── Component ────────────────────────────────────────

export function WizardSummary({
  title,
  subtitle,
  intent,
  created,
  stats,
  tuning,
  primaryAction,
  secondaryActions,
  onBack,
  children,
}: WizardSummaryProps) {
  return (
    <div className="wiz-summary-root">
      {/* Hero */}
      <div className="wiz-hero">
        <SuccessCheckmark />
        <h1 className="wiz-hero-title">{title}</h1>
        {subtitle && <p className="wiz-hero-subtitle">{subtitle}</p>}
      </div>

      {/* Intent */}
      {intent && intent.items.length > 0 && (
        <div className="wiz-section">
          <div className="wiz-section-label">Your Intent</div>
          <div className="wiz-intent-list">
            {intent.items.map((item, i) => (
              <div key={i} className="wiz-intent-row">
                {item.icon && <span className="wiz-intent-icon">{item.icon}</span>}
                <span className="wiz-intent-label">{item.label}</span>
                <span className="wiz-intent-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Created entities */}
      {created && created.entities.length > 0 && (
        <div className="wiz-section">
          <div className="wiz-section-label">What We Built</div>
          <div className="wiz-entity-grid">
            {created.entities.map((entity, i) => {
              const content = (
                <>
                  <span className="wiz-entity-icon">{entity.icon}</span>
                  <span className="wiz-entity-label">{entity.label}</span>
                  <span className="wiz-entity-name">{entity.name}</span>
                  {entity.detail && <span className="wiz-entity-detail">{entity.detail}</span>}
                  {entity.href && <span className="wiz-entity-link">View &rarr;</span>}
                </>
              );

              return entity.href ? (
                <Link key={i} href={entity.href} className="wiz-entity-card">
                  {content}
                </Link>
              ) : (
                <div key={i} className="wiz-entity-card">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && stats.length > 0 && (
        <div className="wiz-section">
          <div className="wiz-stat-bar">
            {stats.map((stat, i) => (
              <div key={i} className="wiz-stat">
                <span className="wiz-stat-value">{stat.value}</span>
                <span className="wiz-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Tuning */}
      {tuning && tuning.traits.length > 0 && (
        <div className="wiz-section">
          <div className="wiz-section-label">AI Style</div>
          <div className="wiz-tuning">
            {tuning.traits.map((trait, i) => (
              <span key={i} className="wiz-trait-pill">{trait}</span>
            ))}
            {tuning.paramCount > 0 && (
              <span className="wiz-tuning-count">
                {tuning.paramCount} parameter{tuning.paramCount !== 1 ? 's' : ''} tuned
              </span>
            )}
          </div>
        </div>
      )}

      {/* Extra content */}
      {children}

      {/* Actions */}
      <div className="wiz-actions">
        {onBack && (
          <button onClick={onBack} className="wiz-action-back">
            Back
          </button>
        )}
        <div className="wiz-actions-spacer" />
        {secondaryActions?.map((action, i) => {
          const props = {
            key: i,
            className: 'wiz-action-secondary',
            onClick: action.onClick,
          };
          return action.href ? (
            <Link {...props} href={action.href}>
              {action.icon}{action.label}
            </Link>
          ) : (
            <button {...props}>{action.icon}{action.label}</button>
          );
        })}
        {primaryAction.href && !primaryAction.disabled ? (
          <Link
            href={primaryAction.href}
            className="wiz-action-primary"
            onClick={primaryAction.onClick}
          >
            {primaryAction.icon}{primaryAction.label}
          </Link>
        ) : (
          <button
            className="wiz-action-primary"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.icon}{primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Animated Checkmark ───────────────────────────────

function SuccessCheckmark() {
  return (
    <svg className="wiz-hero-check" viewBox="0 0 64 64">
      <circle
        className="wiz-check-circle"
        cx="32"
        cy="32"
        r="30"
      />
      <polyline
        className="wiz-check-mark"
        points="20,34 28,42 44,24"
      />
    </svg>
  );
}

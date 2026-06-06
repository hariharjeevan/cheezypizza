'use client'

import React, { JSX } from 'react'
import { useStats, formatBytes } from '../hooks/useStats'

type StatItemProps = {
  value: string
  label: string
  variant: 'card' | 'footer'
}

function StatItem({ value, label, variant }: StatItemProps): JSX.Element {
  if (variant === 'footer') {
    return (
      <span className="sb-footer-item">
        <span className="sb-footer-value">{value}</span>
        <span className="sb-footer-label">{label}</span>
      </span>
    )
  }
  return (
    <div className="sb-item">
      <span className="sb-value">{value}</span>
      <span className="sb-label">{label}</span>
    </div>
  )
}

function LoadingSkeleton({
  variant,
}: {
  variant: 'card' | 'footer'
}): JSX.Element {
  if (variant === 'footer') {
    return (
      <span className="sb-footer-inner">
        {[0, 1, 2, 3].map((i) => (
          <span className="sb-footer-item" key={i}>
            <span
              className="sb-value-loading"
              style={{ width: '36px', height: '11px' }}
            />
            <span
              className="sb-value-loading"
              style={{ width: '28px', height: '8px' }}
            />
          </span>
        ))}
      </span>
    )
  }
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div className="sb-item" key={i}>
          <div className="sb-value-loading" />
          <div
            className="sb-value-loading"
            style={{ width: '40px', height: '10px' }}
          />
        </div>
      ))}
    </>
  )
}

export default function StatsBar({
  variant = 'card',
}: {
  variant?: 'card' | 'footer'
}): JSX.Element {
  const stats = useStats()

  const items = stats
    ? [
        { value: formatBytes(stats.totalBytes), label: 'transferred' },
        { value: stats.totalTransfers.toLocaleString(), label: 'transfers' },
        {
          value: stats.totalPageviews.toLocaleString(),
          label: 'all-time visits',
        },
        { value: stats.monthPageviews.toLocaleString(), label: 'this month' },
      ]
    : null

  return (
    <>
      <style>{`
        /* ── Shared ── */
        .sb-value-loading {
          display: inline-block;
          border-radius: 3px;
          background: var(--pizza-border);
          opacity: 0.5;
        }

        /* ── Card variant (homepage) ── */
        .sb-wrap {
          max-width: 520px;
          width: 100%;
        }
        .sb-inner {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sb-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 10px;
        }
        .sb-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 0 1.5rem;
          flex: 1;
        }
        .sb-item + .sb-item {
          border-left: 1px dashed var(--pizza-border);
        }
        .sb-value {
          font-family: 'Caveat', 'Bradley Hand', cursive;
          font-size: 22px;
          font-weight: 700;
          color: var(--pizza-accent);
          line-height: 1;
          min-height: 22px;
        }
        .sb-label {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
        }
        .sb-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 0;
        }
        .sb-rule::before,
        .sb-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .sb-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }

        /* ── Footer variant ── */
        .sb-footer-wrap {
          width: 100%;
        }
        .sb-footer-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 6px;
          opacity: 0.7;
        }
        .sb-footer-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0;
        }
        .sb-footer-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 0 0.85rem;
        }
        .sb-footer-item + .sb-footer-item {
          border-left: 1px dashed var(--pizza-border);
        }
        .sb-footer-value {
          font-family: 'Caveat', 'Bradley Hand', cursive;
          font-size: 16px;
          font-weight: 700;
          color: var(--pizza-accent);
          line-height: 1;
        }
        .sb-footer-label {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          white-space: nowrap;
        }
      `}</style>

      {variant === 'footer' ? (
        <div className="sb-footer-wrap">
          <p className="sb-footer-eyebrow">PAGE STATS</p>
          <div className="sb-footer-inner">
            {items ? (
              items.map((item) => (
                <StatItem
                  key={item.label}
                  variant="footer"
                  value={item.value}
                  label={item.label}
                />
              ))
            ) : (
              <LoadingSkeleton variant="footer" />
            )}
          </div>
        </div>
      ) : (
        <div className="sb-wrap">
          <p className="sb-eyebrow">PAGE STATS</p>
          <div className="sb-inner">
            {items ? (
              items.map((item) => (
                <StatItem
                  key={item.label}
                  variant="card"
                  value={item.value}
                  label={item.label}
                />
              ))
            ) : (
              <LoadingSkeleton variant="card" />
            )}
          </div>
          <div className="sb-rule">
            <span>✦</span>
          </div>
        </div>
      )}
    </>
  )
}

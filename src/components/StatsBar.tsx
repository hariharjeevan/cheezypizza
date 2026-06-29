'use client'

import React, { JSX } from 'react'
import { useStats, formatBytes, formatBytesSubUnit } from '../hooks/useStats'

type StatItemProps = {
  value: string
  label: string
  subUnit?: string | null
}

function StatItem({ value, label, subUnit }: StatItemProps): JSX.Element {
  return (
    <div className="sb-item">
      <span className="sb-value">{value}</span>
      {subUnit && <span className="sb-subunit">{subUnit}</span>}
      <span className="sb-label">{label}</span>
    </div>
  )
}

function LoadingSkeleton(): JSX.Element {
  return (
    <>
      {[0, 1, 2].map((gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div className="sb-group-divider" />}
          <div className="sb-group">
            <div
              className="sb-value-loading"
              style={{ width: '32px', height: '9px' }}
            />
            <div className="sb-group-items">
              {[0, 1].map((i) => (
                <div className="sb-item" key={i}>
                  <div className="sb-value-loading" />
                  <div
                    className="sb-value-loading"
                    style={{ width: '40px', height: '10px' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
    </>
  )
}

export default function StatsBar(): JSX.Element {
  const stats = useStats()

  const groups = stats
    ? [
        {
          header: 'Internet',
          items: [
            {
              value: formatBytes(stats.totalBytes),
              label: 'transferred',
              subUnit: formatBytesSubUnit(stats.totalBytes),
            },
            {
              value: stats.totalTransfers.toLocaleString(),
              label: 'transfers',
            },
          ],
        },
        {
          header: 'Local',
          items: [
            {
              value: formatBytes(stats.localBytes),
              label: 'transferred',
              subUnit: formatBytesSubUnit(stats.localBytes),
            },
            {
              value: stats.localTransfers.toLocaleString(),
              label: 'transfers',
            },
          ],
        },
        {
          header: 'Visits',
          items: [
            { value: stats.totalPageviews.toLocaleString(), label: 'all-time' },
            {
              value: stats.monthPageviews.toLocaleString(),
              label: 'this month',
            },
          ],
        },
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
          width: 48px;
          height: 22px;
        }

        /* ── Layout ── */
        .sb-wrap {
          max-width: 720px;
          width: 100%;
        }
        .sb-inner {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sb-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 0 1.5rem;
          flex: 1;
        }
        @media (max-width: 600px) {
          .sb-inner {
            justify-content: flex-start;
            overflow-x: auto;
            scrollbar-width: none;
          }
          .sb-inner::-webkit-scrollbar {
            display: none;
          }
          .sb-item {
            flex: none;
            flex-shrink: 0;
            min-width: 110px;
          }
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
        .sb-group-items .sb-item + .sb-item {
          border-left: 1px dashed var(--pizza-border);
        }
        .sb-value {
          font-family: 'Caveat', 'Bradley Hand', cursive;
          font-size: 20px;
          text-align: center;
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

        /* ── Groups ── */
        .sb-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex: 1;
        }
        .sb-group-header {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          opacity: 0.7;
        }
        .sb-group-items {
          display: flex;
          width: 100%;
        }
        .sb-group-divider {
          width: 1px;
          align-self: stretch;
          background: var(--pizza-border);
          flex-shrink: 0;
        }
        .sb-subunit {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--pizza-text-muted);
          opacity: 0.65;
          line-height: 1;
        }
      `}</style>

      <div className="sb-wrap">
        <p className="sb-eyebrow">PAGE STATS</p>
        <div className="sb-inner">
          {groups ? (
            groups.map((group, gi) => (
              <React.Fragment key={group.header}>
                {gi > 0 && <div className="sb-group-divider" />}
                <div className="sb-group">
                  <span className="sb-group-header">{group.header}</span>
                  <div className="sb-group-items">
                    {group.items.map((item) => (
                      <StatItem
                        key={item.label}
                        value={item.value}
                        label={item.label}
                        subUnit={item.subUnit}
                      />
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))
          ) : (
            <LoadingSkeleton />
          )}
        </div>
        <div className="sb-rule">
          <span>✦</span>
        </div>
      </div>
    </>
  )
}

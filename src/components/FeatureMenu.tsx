// components/FeatureMenu.tsx
import React from 'react'
import { LuServerOff, LuFileStack } from 'react-icons/lu'
import { GrResume } from 'react-icons/gr'

const items = [
  {
    icon: <GrResume />,
    sub: 'never lose your slice',
    name: 'Resume support',
    desc: 'Drop the connection, close the tab, lose the wifi. Your transfer picks up exactly where it left off — no do-overs.',
  },
  {
    icon: <LuFileStack />,
    sub: 'family size, always',
    name: 'Large files',
    desc: 'No cap on size. Raw footage, full archives, giant PSDs — send it all without a second thought.',
  },
  {
    icon: <LuServerOff />,
    sub: 'straight from oven to you',
    name: 'No middleman',
    desc: 'Browser to browser, nothing in between. Your files never touch our servers.',
  },
]

export default function FeatureMenu() {
  return (
    <>
      <style>{`
        .fm-wrap {
          max-width: 520px;
          width: 100%;
        }
        .fm-paper {
          background: var(--pizza-bg);
          border: 1.5px solid var(--pizza-border);
          border-radius: 3px;
          padding: 0 2rem;
          position: relative;
        }
        .fm-paper::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px dashed var(--pizza-border);
          border-radius: 2px;
          pointer-events: none;
        }
        .fm-inner {
          padding: 1.5rem 0;
        }
        .fm-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 4px;
        }
        .fm-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 21px;
          color: var(--pizza-text);
          text-align: center;
          margin-bottom: 0;
        }
        .fm-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 16px;
        }
        .fm-rule::before,
        .fm-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .fm-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }
        .fm-item {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px dashed var(--pizza-border);
          align-items: center;
        }
        .fm-item:last-child {
          border-bottom: none;
        }
        .fm-dot {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1.5px solid var(--pizza-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--pizza-accent);
          font-size: 24px;
          line-height: 1;
        }
        .fm-name {
          font-family: 'Caveat', 'Bradley Hand', cursive;
          font-size: 22px;
          font-weight: 700;
          color: var(--pizza-text);
          line-height: 1;
          margin-bottom: 2px;
        }
        .fm-sub {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 16px;
          color: var(--pizza-text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .fm-desc {
          font-size: 16px;
          color: var(--pizza-text-muted);
          line-height: 1.55;
        }
        .fm-check {
          font-family: 'Caveat', cursive;
          font-size: 20px;
          color: var(--pizza-accent);
          font-weight: 700;
          flex-shrink: 0;
          align-self: center;
        }

        /* Dark theme */
        .dark .fm-paper {
          background: #1e1a17;
          border-color: #3d3028;
        }
        .dark .fm-paper::before {
          border-color: #3d3028;
        }
        .dark .fm-rule::before,
        .dark .fm-rule::after {
          background: #3d3028;
        }
        .dark .fm-item {
          border-bottom-color: #3d3028;
        }
      `}</style>

      <div className="fm-wrap">
        <div className="fm-paper">
          <div className="fm-inner">
            <p className="fm-eyebrow">today&apos;s specialities</p>
            <p className="fm-title">What makes us different</p>
            <div className="fm-rule">
              <span>✦</span>
            </div>
            {items.map((item) => (
              <div className="fm-item" key={item.name}>
                <div className="fm-dot">{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <p className="fm-name">{item.name}</p>
                  <p className="fm-sub">{item.sub}</p>
                  <p className="fm-desc">{item.desc}</p>
                </div>
                <span className="fm-check">✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

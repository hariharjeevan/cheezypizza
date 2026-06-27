// components/HelpUs.tsx
import React from 'react'
import { LuSearch } from 'react-icons/lu'
import { GoHeartFill } from 'react-icons/go'

export default function HelpUs() {
  return (
    <>
      <style>{`
        .hu-wrap {
          width: 100%;
        }
        .hu-box {
          position: relative;
          border: 1.5px solid var(--pizza-border);
          border-radius: 3px;
          background: var(--pizza-bg);
          padding: 0 2rem 1.5rem;
          box-sizing: border-box;
        }
        .hu-box::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px dashed var(--pizza-border);
          border-radius: 2px;
          pointer-events: none;
        }
        .hu-inner {
          padding: 1.5rem 0 0;
        }
        .hu-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          margin-bottom: 4px;
          text-align: center;
        }
        .hu-heading {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 21px;
          font-weight: normal;
          color: var(--pizza-text);
          margin-bottom: 0;
          line-height: 1.3;
          text-align: center;
        }
        .hu-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 16px;
        }
        .hu-rule::before,
        .hu-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .hu-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }
        .hu-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
          text-align: center;
        }
        .hu-row:last-child {
          margin-bottom: 0;
        }
        .hu-icon {
          color: var(--pizza-text-muted);
          flex-shrink: 0;
          margin-top: 3px;
        }
        .hu-text {
          font-size: 15px;
          color: var(--pizza-text-muted);
          line-height: 1.6;
        }
        .hu-text strong {
          color: var(--pizza-text);
          font-weight: 600;
        }
        .hu-text code {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          background: var(--pizza-bg-subtle);
          border: 1px solid var(--pizza-border);
          border-radius: 2px;
          padding: 0 4px;
          color: var(--pizza-accent);
        }
        .hu-or-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0;
        }
        .hu-or-divider::before,
        .hu-or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          border-top: 1px dashed var(--pizza-border);
        }
        .hu-or-divider span {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
        }
        .hu-donate-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-bottom: 2px;
        }
        .hu-donate-label {
          font-size: 15px;
          color: var(--pizza-text-muted);
          letter-spacing: 0.04em;
          text-align: center;
        }
        .hu-donate-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 20px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #fff;
          background: #16a34a;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
        }
        .hu-donate-btn:hover {
          background: #15803d;
        }

        .dark .hu-box {
          background: #1e1a17;
          border-color: #3d3028;
        }
        .dark .hu-box::before {
          border-color: #3d3028;
        }
        .dark .hu-rule::before,
        .dark .hu-rule::after {
          background: #3d3028;
        }
        .dark .hu-or-divider::before,
        .dark .hu-or-divider::after {
          border-top-color: #3d3028;
        }
        .dark .hu-text code {
          background: #141210;
          border-color: #3d3028;
        }
      `}</style>

      <div className="hu-wrap">
        <div className="hu-box">
          <div className="hu-inner">
            <p className="hu-eyebrow">support the project</p>
            <h2 className="hu-heading">Help keep CheezyPizza free</h2>

            <div className="hu-rule">
              <span>✦</span>
            </div>

            <div className="hu-row">
              <LuSearch size={15} className="hu-icon" aria-hidden="true" />
              <p className="hu-text">
                <strong>Boost our SEO for free —</strong> search{' '}
                <code>cheezypizza</code> on Google and click{' '}
                <code>www.cheezypizza.in</code>. It takes 10 seconds and helps
                others find us.
              </p>
            </div>

            <div className="hu-or-divider">
              <span>or</span>
            </div>

            <div className="hu-donate-row">
              <span className="hu-donate-label">
                Support us with a small donation — every bit helps
              </span>
              <a
                href="https://github.com/hariharjeevan/cheezypizza#webrtc-based-p2p-file-transfers-in-your-browser-"
                className="hu-donate-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GoHeartFill /> Donate
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

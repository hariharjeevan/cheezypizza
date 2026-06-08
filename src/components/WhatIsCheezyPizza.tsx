// components/WhatIsCheezyPizza.tsx
import React from 'react'

export default function WhatIsCheezyPizza() {
  return (
    <>
      <style>{`
        .wcp-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-self: stretch;
        }
        .wcp-paper {
          background: var(--pizza-bg);
          border: 1.5px solid var(--pizza-border);
          border-radius: 3px;
          padding: 0 2rem 0.1rem;
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .wcp-paper::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px dashed var(--pizza-border);
          border-radius: 2px;
          pointer-events: none;
        }
        .wcp-inner {
          padding: 1.5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .wcp-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 4px;
        }
        .wcp-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 21px;
          color: var(--pizza-text);
          text-align: center;
          margin-bottom: 0;
        }
        .wcp-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 16px;
        }
        .wcp-rule::before,
        .wcp-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .wcp-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }
        .wcp-body {
          font-size: 15px;
          color: var(--pizza-text-muted);
          line-height: 1.7;
          flex: 1;
        }
        .wcp-body p {
          margin-bottom: 0.75rem;
        }
        .wcp-body p:last-child {
          margin-bottom: 0;
        }
        .wcp-keyword {
          font-family: 'Caveat', cursive;
          font-size: 19px;
          font-weight: 700;
          color: var(--pizza-accent);
        }
        .wcp-mono {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 11px;
          color: var(--pizza-text-muted);
        }

        /* Dark */
        .dark .wcp-paper {
          background: #1e1a17;
          border-color: #3d3028;
        }
        .dark .wcp-paper::before {
          border-color: #3d3028;
        }
        .dark .wcp-rule::before,
        .dark .wcp-rule::after {
          background: #3d3028;
        }
      `}</style>

      <section className="wcp-wrap" aria-label="About CheezyPizza">
        <div className="wcp-paper">
          <div className="wcp-inner">
            <p className="wcp-eyebrow">the story so far</p>
            <h2 className="wcp-title">What is CheezyPizza?</h2>
            <div className="wcp-rule">
              <span>✦</span>
            </div>

            <div className="wcp-body">
              <p>
                <span className="wcp-keyword">
                  CheezyPizza (fork of FilePizza)
                </span>{' '}
                is a free, open-source peer-to-peer file transfer tool that runs
                entirely in your browser — no installs, no accounts, no servers
                holding your data.
              </p>
              <p>
                CheezyPizza is a fork and an alternative of{' '}
                <a
                  href="https://file.pizza"
                  className="wcp-mono"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="wcp-keyword">FilePizza</span>{' '}
                </a>
                , the original browser-based p2p file sharing app built by Alex
                Kern &amp; Neeraj Baid. CheezyPizza extends it with{' '}
                <strong style={{ color: 'var(--pizza-text)' }}>
                  resume support, better large-file handling, with better error
                  handling
                </strong>{' '}
                and an ongoing commitment to keeping transfers fast and private.
              </p>
              <p>
                Under the hood, WebRTC creates a direct connection between
                sender and receiver. Files stream from one browser to the other
                — your data never touches a server. Think of it as{' '}
                <span className="wcp-keyword">AirDrop for the web</span>, but it
                works across any device, any OS, any browser.
              </p>
              <p>
                If you have used FilePizza before, CheezyPizza will feel right
                at home. Drop a file, share the link, done.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

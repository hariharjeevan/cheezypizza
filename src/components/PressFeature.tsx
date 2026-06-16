// components/PressFeature.tsx
import React from 'react'

const pressItems = [
  {
    publication: "It's FOSS",
    url: 'https://itsfoss.com/cheezy-pizza/',
    logo: '🐧',
    headline:
      'Tired of File Size Limits? This Open Source Tool Sends Large Files Directly Browser to Browser',
    quote:
      'If you want a peer-to-peer alternative, CheezyPizza is worth trying.',
    author: 'Abhishek Prakash',
    date: '2026-06-09',
    displayDate: 'Jun 9, 2026',
    tag: 'Applications',
  },
]

export default function PressFeature() {
  return (
    <>
      <style>{`
        .press-wrap {
          width: 100%;
        }
        .press-paper {
          background: var(--pizza-bg);
          border: 1.5px solid var(--pizza-border);
          border-radius: 3px;
          padding: 0 2rem 1.5rem;
          position: relative;
          box-sizing: border-box;
        }
        .press-paper::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px dashed var(--pizza-border);
          border-radius: 2px;
          pointer-events: none;
        }
        .press-inner {
          padding: 1.5rem 0 0;
        }
        .press-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 4px;
        }
        .press-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 21px;
          color: var(--pizza-text);
          text-align: center;
          margin-bottom: 0;
        }
        .press-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 16px;
        }
        .press-rule::before,
        .press-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .press-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }

        .press-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 0 4px;
        }

        .press-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .press-logo-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--pizza-bg-subtle);
          border: 1px solid var(--pizza-border);
          border-radius: 99px;
          padding: 4px 10px 4px 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--pizza-text);
          flex-shrink: 0;
        }

        .press-logo-pill span:first-child {
          font-size: 16px;
          line-height: 1;
        }

        .press-meta {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 11px;
          color: var(--pizza-text-muted);
          letter-spacing: 0.04em;
        }

        .press-tag {
          display: inline-block;
          background: var(--pizza-accent);
          color: #fff;
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 2px;
          margin-left: 6px;
          vertical-align: middle;
        }

        .press-headline {
          font-size: 15px;
          font-weight: 600;
          color: var(--pizza-text);
          line-height: 1.4;
          margin: 0;
        }

        .press-headline a {
          color: inherit;
          text-decoration: none;
        }

        .press-headline a:hover {
          color: var(--pizza-accent);
        }

        .press-description {
          color: var(--pizza-text);
          line-height: 1.6;
          font-size: 14px;
          margin: 0;
        }

        .press-pullquote {
          position: relative;
          padding: 10px 14px 10px 20px;
          border-left: 3px solid var(--pizza-accent);
          margin: 0;
        }

        .press-pullquote::before {
          content: '“';
          position: absolute;
          top: -4px;
          left: 6px;
          font-family: Georgia, serif;
          font-size: 36px;
          line-height: 1;
          color: var(--pizza-accent);
          opacity: 0.5;
        }

        .press-pullquote p {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 15px;
          color: var(--pizza-text);
          line-height: 1.6;
          margin: 0;
        }

        .press-pullquote footer {
          margin-top: 6px;
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 11px;
          color: var(--pizza-text-muted);
        }

        .press-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--pizza-accent);
          text-decoration: none;
          border: 1px solid var(--pizza-accent);
          border-radius: 2px;
          padding: 5px 10px;
          transition: background 0.15s, color 0.15s;
          align-self: flex-start;
        }

        .press-cta:hover {
          background: var(--pizza-accent);
          color: #fff;
        }

        .press-cta svg {
          width: 11px;
          height: 11px;
          flex-shrink: 0;
        }

        .dark .press-paper {
          background: #1e1a17;
          border-color: #3d3028;
        }

        .dark .press-paper::before {
          border-color: #3d3028;
        }

        .dark .press-rule::before,
        .dark .press-rule::after {
          background: #3d3028;
        }

        .dark .press-logo-pill {
          background: #2a231d;
          border-color: #3d3028;
        }
      `}</style>

      <section className="press-wrap" aria-labelledby="press-heading">
        <div className="press-paper">
          <div className="press-inner">
            <p className="press-eyebrow">as seen in the wild</p>

            <h2 id="press-heading" className="press-title">
              Press &amp; Coverage
            </h2>

            <div className="press-rule">
              <span>✦</span>
            </div>

            {pressItems.map((item) => (
              <article
                className="press-card"
                key={item.url}
                itemScope
                itemType="https://schema.org/NewsArticle"
              >
                <header className="press-card-top">
                  <span className="press-logo-pill">
                    <span>{item.logo}</span>
                    <span
                      itemProp="publisher"
                      itemScope
                      itemType="https://schema.org/Organization"
                    >
                      <span itemProp="name">{item.publication}</span>
                    </span>
                  </span>

                  <span className="press-meta">
                    <time dateTime={item.date}>{item.displayDate}</time>

                    <span className="press-tag">{item.tag}</span>
                  </span>
                </header>

                <h3 className="press-headline" itemProp="headline">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.headline}
                  </a>
                </h3>

                <p className="press-description">
                  CheezyPizza was featured by It&apos;s FOSS as an open-source
                  WebRTC-powered peer-to-peer file transfer application that
                  allows users to send large files directly between browsers
                  without cloud storage, uploads, or intermediaries.
                </p>

                <blockquote className="press-pullquote">
                  <p>{item.quote}</p>
                  <footer>
                    — <span itemProp="author">{item.author}</span>
                  </footer>
                </blockquote>

                <a
                  href={item.url}
                  className="press-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read full article
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 9.5l7-7M4 2.5h5.5V8" />
                  </svg>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

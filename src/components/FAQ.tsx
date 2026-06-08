'use client'

// components/FAQ.tsx
import React, { useState } from 'react'

const faqs = [
  {
    q: 'What is CheezyPizza? How is it related to FilePizza?',
    a: 'CheezyPizza is a free, open-source, peer-to-peer file transfer tool that runs entirely in your browser — no installs, no accounts, no servers holding your data. It is a fork of FilePizza (file.pizza), the original browser-based p2p file sharing app built by Alex Kern and Neeraj Baid. CheezyPizza builds on that foundation with resumable downloads, SHA-256 integrity verification, large file support, better error handling, and automatic reconnect on network change.',
  },
  {
    q: 'How are my files sent?',
    a: "Files are sent directly from your browser to the downloader's browser over WebRTC. They never pass through any server. The uploader must keep their browser window open until the transfer is complete.",
  },
  {
    q: 'Is it free? Do I need an account?',
    a: 'Completely free and open-source. No account, no sign-up, no email required — just drop a file and share the link.',
  },
  {
    q: 'How big can my files be?',
    a: 'Very large. CheezyPizza streams files incrementally to the Origin Private File System (OPFS) or IndexedDB as chunks arrive, so the maximum file size is determined by your browser and total disk space rather than a hard cap.',
  },
  {
    q: 'What happens if my download is interrupted?',
    a: 'CheezyPizza saves your progress automatically. If the connection drops or the network switches (e.g. mobile data to Wi-Fi), the download resumes from exactly where it left off once the connection is restored — no re-downloading data you already received.',
  },
  {
    q: "Are my files encrypted? How do I know they weren't corrupted?",
    a: "All WebRTC communications are encrypted using DTLS. After each transfer completes, the uploader computes a SHA-256 hash and sends it to the downloader. CheezyPizza verifies the hash before offering the file for saving — if they don't match, the file is flagged and discarded automatically.",
  },
  {
    q: 'Can I password-protect my transfer?',
    a: 'Yes. Set a password when uploading. The downloader must enter the correct password before any file is transferred.',
  },
  {
    q: 'Can multiple people download at once?',
    a: 'Yes. Share the link with as many people as you like — all of them can download simultaneously.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'CheezyPizza works in all major modern browsers. Chrome and Chromium-based browsers (Edge, Opera, Vivaldi) have full feature support including resumable downloads. Firefox works with some limitations on mobile. Safari has not been fully tested yet. Brave has limited OPFS support.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      <style>{`
        .faq-wrap {
          width: 100%;
        }
        .faq-paper {
          background: var(--pizza-bg);
          border: 1.5px solid var(--pizza-border);
          border-radius: 3px;
          padding: 0 2rem 1.5rem;
          position: relative;
          box-sizing: border-box;
        }
        .faq-paper::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px dashed var(--pizza-border);
          border-radius: 2px;
          pointer-events: none;
        }
        .faq-inner {
          padding: 1.5rem 0 0;
        }
        .faq-eyebrow {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pizza-text-muted);
          text-align: center;
          margin-bottom: 4px;
        }
        .faq-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 21px;
          color: var(--pizza-text);
          text-align: center;
          margin-bottom: 0;
        }
        .faq-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 16px;
        }
        .faq-rule::before,
        .faq-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--pizza-border);
        }
        .faq-rule span {
          font-size: 11px;
          color: var(--pizza-text-muted);
        }
        .faq-item {
          border-bottom: 1px dashed var(--pizza-border);
        }
        .faq-item:last-child {
          border-bottom: none;
        }
        .faq-question {
          width: 100%;
          background: none;
          border: none;
          padding: 14px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
        }
        .faq-question-text {
          font-size: 15px;
          font-weight: 500;
          color: var(--pizza-text);
          line-height: 1.3;
          flex: 1;
        }
        .faq-chevron {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          color: var(--pizza-accent);
          transition: transform 0.2s ease;
        }
        .faq-chevron.open {
          transform: rotate(180deg);
        }
        .faq-answer {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.25s ease, padding 0.2s ease;
        }
        .faq-answer.open {
          max-height: 300px;
        }
        .faq-answer-inner {
          font-size: 14px;
          color: var(--pizza-text-muted);
          line-height: 1.7;
          padding-bottom: 14px;
        }

        /* Dark */
        .dark .faq-paper {
          background: #1e1a17;
          border-color: #3d3028;
        }
        .dark .faq-paper::before {
          border-color: #3d3028;
        }
        .dark .faq-rule::before,
        .dark .faq-rule::after {
          background: #3d3028;
        }
        .dark .faq-item {
          border-bottom-color: #3d3028;
        }
        .dark .faq-question-text {
          color: var(--pizza-text);
        }
      `}</style>

      <section className="faq-wrap" aria-label="Frequently Asked Questions">
        <div className="faq-paper">
          <div className="faq-inner">
            <p className="faq-eyebrow">got questions?</p>
            <h2 className="faq-title">Frequently Asked Questions</h2>
            <div className="faq-rule">
              <span>✦</span>
            </div>

            {faqs.map((faq, i) => (
              <div className="faq-item" key={i}>
                <button
                  className="faq-question"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  <svg
                    className={`faq-chevron${open === i ? ' open' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div
                  className={`faq-answer${open === i ? ' open' : ''}`}
                  role="region"
                >
                  <p className="faq-answer-inner">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

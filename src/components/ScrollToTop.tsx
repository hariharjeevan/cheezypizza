'use client'

import React, { useEffect, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { GoHeartFill } from 'react-icons/go'
import { TiArrowUpThick } from 'react-icons/ti'

export default function ScrollToTopWidget() {
  const [visible, setVisible] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>

    const onScroll = () => {
      const nearBottom =
        window.scrollY + window.innerHeight >= document.body.scrollHeight - 80
      setVisible(window.scrollY > 300 && !nearBottom)
      setPanelVisible(true)
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => setPanelVisible(false), 800)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(hideTimer)
    }
  }, [])

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <>
      <style>{`
        .stt-cluster {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.25s ease, transform 0.25s ease;
          pointer-events: none;
        }
        .stt-cluster.stt-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .stt-panel {
          width: 180px;
          background: var(--pizza-bg);
          border: 1px solid var(--pizza-border);
          border-bottom: none;
          border-radius: 2px 2px 0 0;
          padding: 8px 7px 7px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.07);
        }

        .stt-panel-row {
          display: flex;
          align-items: flex-start;
          gap: 5px;
        }
        .stt-panel-row svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--pizza-text-muted);
        }
        .stt-panel-text {
          font-size: 12px;
          line-height: 1.5;
          color: var(--pizza-text-muted);
        }
        .stt-panel-text code {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          background: var(--pizza-bg-subtle);
          border: 1px solid var(--pizza-border);
          border-radius: 2px;
          padding: 0 2px;
          color: var(--pizza-accent);
        }
        .stt-divider {
          border: none;
          border-top: 1px dashed #443527;
          margin: 0;
        }

        .stt-donate {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 100%;
          padding: 4px 0;
          font-size: 11px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.08em;
          color: #fff;
          background: #16a34a;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
          box-sizing: border-box;
        }
        .stt-donate:hover {
          background: #15803d;
        }

        .stt-btn {
          width: 36px;
          height: 36px;
          border-radius: 0 0 2px 2px;
          border: 1px solid var(--pizza-border);
          background: #fb923c;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, transform 0.1s;
          box-shadow: 0 2px 10px rgba(0,0,0,0.07);
          flex-shrink: 0;
        }
        .stt-btn:hover {
          border-color: var(--pizza-accent);
          color: var(--pizza-accent);
        }
        .stt-btn:active {
          transform: scale(0.95);
        }

        .dark .stt-panel,
        .dark .stt-btn {
          background: #1e1a17;
          border-color: #3d3028;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .dark .stt-btn {
          background: #fb923c;
          color: #fff;
        }
        .dark .stt-btn:active {
          transform: scale(0.95);
        }
        .dark .stt-btn:hover {
          border-color: #fff;
          color: #fff;
        }
        .dark .stt-panel-text code {
          background: #141210;
          border-color: #3d3028;
        }
        .dark .stt-divider {
          border-top-color: #a57e66;
        }

        @media (max-width: 640px) {
          .stt-panel {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .stt-panel.stt-panel-visible {
            opacity: 1;
            pointer-events: auto;
          }
          .stt-btn {
            border-radius: 2px;
            transition: border-color 0.15s, color 0.15s, transform 0.1s, border-radius 0.3s ease;
          }
          .stt-panel.stt-panel-visible + .stt-btn {
            border-radius: 0 0 2px 2px;
          }
        }
      `}</style>

      <div
        className={`stt-cluster${visible ? ' stt-visible' : ''}`}
        aria-hidden={!visible}
      >
        <div className={`stt-panel${panelVisible ? ' stt-panel-visible' : ''}`}>
          <div className="stt-panel-row">
            <LuSearch size={13} className="hu-icon" aria-hidden="true" />
            <p className="stt-panel-text">
              Search <code>cheezypizza</code> on Google and click{' '}
              <code>www.cheezypizza.in</code> It takes 10 seconds and helps
              others find us.
            </p>
          </div>

          <hr className="stt-divider" />

          <a
            href="https://github.com/hariharjeevan/cheezypizza#webrtc-based-p2p-file-transfers-in-your-browser-"
            className="stt-donate"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={visible ? 0 : -1}
          >
            <GoHeartFill />
            DONATE
          </a>
        </div>

        <button
          className="stt-btn"
          onClick={scrollUp}
          aria-label="Scroll to top"
          title="Back to top"
          tabIndex={visible ? 0 : -1}
        >
          <TiArrowUpThick size={20} />
        </button>
      </div>
    </>
  )
}

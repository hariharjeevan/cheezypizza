// src/app/local/page.tsx
'use client'

import React, { JSX, useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import Spinner from '../../components/Spinner'
import ProgressBar from '../../components/ProgressBar'
import { useLocalDiscovery } from '../../hooks/useLocalDiscovery'
import { useLocalDownloader } from '../../hooks/useLocalDownloader'
import { useDeviceInfo } from '../../hooks/useDeviceInfo'
import {
  LuWifi,
  LuWifiOff,
  LuCheckCheck,
  LuTriangleAlert,
  LuFile,
  LuArrowLeft,
  LuMonitor,
  LuSmartphone,
  LuTablet,
  LuArrowRight,
} from 'react-icons/lu'

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return '—'
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

function PageLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{ minHeight: '600px' }}
      className="flex flex-col items-center justify-start"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          padding: '40px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <Spinner direction="up" />
        {children}
      </div>
    </div>
  )
}

function BackButton({
  href = '/',
  label = '← Back to home',
}: {
  href?: string
  label?: string
}) {
  return (
    <a
      href={href}
      className="btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <LuArrowLeft size={14} aria-hidden="true" />
      <span style={{ fontSize: 13 }}>{label}</span>
    </a>
  )
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--pizza-border)',
      }}
    >
      <span
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--pizza-text-muted)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: 'var(--pizza-text)',
          textAlign: 'right',
          marginLeft: 16,
        }}
      >
        {children}
      </span>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        border: '1px solid var(--pizza-border)',
        borderRadius: 2,
        background: 'var(--pizza-bg)',
        padding: '0 1.25rem',
      }}
    >
      {children}
    </div>
  )
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--pizza-text-muted)',
        padding: '12px 0 8px',
        borderBottom: '1px solid var(--pizza-border)',
        marginBottom: 0,
      }}
    >
      {children}
    </p>
  )
}

function DeviceMetaRows() {
  const { browser, os, deviceType, platform } = useDeviceInfo()
  const DeviceIcon =
    deviceType === 'mobile'
      ? LuSmartphone
      : deviceType === 'tablet'
        ? LuTablet
        : LuMonitor
  return (
    <>
      <MetaRow label="device">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <DeviceIcon
            size={13}
            aria-hidden="true"
            style={{ color: 'var(--pizza-text-muted)' }}
          />
          {os} · {browser}
        </span>
      </MetaRow>
      <MetaRow label="platform">
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
          {platform === 'cheezypizza' ? '🍕 CheezyPizza app' : 'Web'}
        </span>
      </MetaRow>
    </>
  )
}

export default function LocalReceivePage(): JSX.Element {
  const [senderName, setSenderName] = useState<string | null>(null)
  const downloader = useLocalDownloader()
  const handleCancel = useCallback(() => {
    downloader.cancel()
    discoveryRef.current?.cleanup()
    setSenderName(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReject = useCallback(() => {
    downloader.rejectTransfer()
    discoveryRef.current?.cleanup()
    setSenderName(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const discoveryRef = useRef<ReturnType<typeof useLocalDiscovery> | null>(null)
  const attachRef = useRef(downloader.attachDataChannel)
  attachRef.current = downloader.attachDataChannel

  const discovery = useLocalDiscovery({
    onSelected: useCallback((fromId: string, fromName: string) => {
      setSenderName(fromName)
      discoveryRef.current?.prepareAnswer(fromId, (dc) => {
        attachRef.current(dc)
      })
    }, []),
  })

  discoveryRef.current = discovery

  const { myName, isConnected, error } = discovery
  const dl = downloader.state

  const handleReset = useCallback(() => {
    discoveryRef.current?.cleanup()
    downloader.setState({ status: 'idle' })
    setSenderName(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dl.status === 'awaiting-accept') {
    const totalBytes = dl.files.reduce((s, f) => s + f.size, 0)
    return (
      <PageLayout>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--pizza-text)',
            maxWidth: 520,
          }}
        >
          <strong>{senderName ?? 'Someone'}</strong> wants to send you{' '}
          {dl.files.length === 1 ? 'a file' : `${dl.files.length} files`}.
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Panel>
            <PanelHeading>incoming files</PanelHeading>
            <MetaRow label="from">
              <span style={{ fontWeight: 600 }}>{senderName ?? '…'}</span>
            </MetaRow>
            <MetaRow label="total size">{formatBytes(totalBytes)}</MetaRow>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {dl.files.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--pizza-border)',
                    fontSize: 13,
                  }}
                >
                  <LuFile
                    size={14}
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: 'var(--pizza-text-muted)' }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--pizza-text)',
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 11,
                      color: 'var(--pizza-text-muted)',
                    }}
                  >
                    {formatBytes(f.size)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 8 }} />
          </Panel>
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <button onClick={handleReject} className="btn-secondary">
              Decline
            </button>
            <button
              onClick={async () => {
                // On multi-file transfers, call showSaveFilePicker synchronously
                // within the user gesture so Android Chrome grants FSA access.
                // Any await before this call would break the gesture token.
                let handle: FileSystemFileHandle | undefined
                if (
                  dl.status === 'awaiting-accept' &&
                  dl.files.length >= 2 &&
                  typeof window !== 'undefined' &&
                  typeof window.showSaveFilePicker === 'function'
                ) {
                  const zipName = `cheezypizza_files_${Date.now()}.zip`
                  try {
                    handle = await window.showSaveFilePicker({
                      suggestedName: zipName,
                    })
                  } catch (err) {
                    if (
                      err instanceof DOMException &&
                      err.name === 'AbortError'
                    )
                      return
                    // FSA unavailable — proceed without handle, mobile fallback will apply
                  }
                }
                downloader.acceptTransfer(handle)
              }}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Accept
              <LuArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (dl.status === 'connecting') {
    return (
      <PageLayout>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--pizza-text)',
            maxWidth: 520,
          }}
        >
          Establishing connection…
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Panel>
            <PanelHeading>incoming transfer</PanelHeading>
            <MetaRow label="from">
              <span style={{ fontWeight: 600 }}>{senderName ?? '…'}</span>
            </MetaRow>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
              }}
            >
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--pizza-text-muted)',
                }}
              >
                status
              </span>
              <span style={{ fontSize: 14, color: 'var(--pizza-accent-warm)' }}>
                Connecting…
              </span>
            </div>
          </Panel>
        </div>
      </PageLayout>
    )
  }

  if (dl.status === 'receiving') {
    return (
      <PageLayout>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--pizza-text)',
            maxWidth: 520,
          }}
        >
          Receiving files from {senderName ?? '…'}
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Panel>
            <PanelHeading>transfer</PanelHeading>
            <MetaRow label="from">
              <span style={{ fontWeight: 600 }}>{senderName ?? '…'}</span>
            </MetaRow>
            <MetaRow label="file">
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 260,
                }}
              >
                {dl.fileName}
              </span>
            </MetaRow>
            <MetaRow label="received">
              {formatBytes(dl.bytesReceived)} / {formatBytes(dl.totalBytes)}
            </MetaRow>
            <MetaRow label="speed">
              {formatSpeed(dl.status === 'receiving' ? dl.speedBps : 0)}
            </MetaRow>
          </Panel>
          <div style={{ width: '100%' }}>
            <ProgressBar value={dl.bytesReceived} max={dl.totalBytes} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleCancel} className="btn-secondary">
              Stop download
            </button>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (dl.status === 'done') {
    return (
      <PageLayout>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--pizza-text)',
            maxWidth: 520,
          }}
        >
          Transfer complete.
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Panel>
            <PanelHeading>received</PanelHeading>
            <MetaRow label="from">
              <span style={{ fontWeight: 600 }}>{senderName ?? '…'}</span>
            </MetaRow>
            <MetaRow label="files">{dl.fileNames.length}</MetaRow>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {dl.fileNames.map((name) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--pizza-border)',
                    fontSize: 13,
                  }}
                >
                  <LuFile
                    size={14}
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: 'var(--pizza-text-muted)' }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 14,
                      color: 'var(--pizza-text)',
                    }}
                  >
                    {name}
                  </span>
                  <LuCheckCheck
                    size={14}
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: '#16a34a' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ height: 12 }} />
          </Panel>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {dl.zipBlobUrl ? (
              <a
                href={dl.zipBlobUrl}
                download
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() =>
                  setTimeout(() => URL.revokeObjectURL(dl.zipBlobUrl!), 10_000)
                }
              >
                Tap to save zip
                <LuArrowRight size={14} aria-hidden="true" />
              </a>
            ) : null}
            <button onClick={handleReset} className="btn-primary">
              Receive more
            </button>
            <BackButton href="/" label="Back to home" />
          </div>
        </div>
      </PageLayout>
    )
  }

  if (dl.status === 'error') {
    return (
      <PageLayout>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--pizza-text)',
            maxWidth: 520,
          }}
        >
          Transfer failed.
        </p>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Panel>
            <PanelHeading>error</PanelHeading>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '12px 0',
                color: '#ef4444',
                fontSize: 14,
              }}
            >
              <LuTriangleAlert
                size={14}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>{dl.message}</span>
            </div>
          </Panel>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <button onClick={handleReset} className="btn-primary">
              Try again
            </button>
            <BackButton href="/" label="Back to home" />
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--pizza-text)',
            marginBottom: 8,
          }}
        >
          CheezyPizza - Local Share
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--pizza-text-muted)',
            lineHeight: 1.6,
            marginBottom: 0,
          }}
        >
          {senderName
            ? `${senderName} is connecting…`
            : 'Receive files from nearby devices on the same Wi-Fi network — directly in your browser, no cloud involved.'}
        </p>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Panel>
          <PanelHeading>your device</PanelHeading>
          <MetaRow label="name">
            <span style={{ fontWeight: 600 }}>{myName ?? '…'}</span>
          </MetaRow>
          <DeviceMetaRows />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
            }}
          >
            <span
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--pizza-text-muted)',
              }}
            >
              network
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                color: error
                  ? '#ef4444'
                  : isConnected
                    ? '#16a34a'
                    : 'var(--pizza-text-muted)',
              }}
            >
              {error ? (
                <>
                  <LuWifiOff size={14} aria-hidden="true" /> Error
                </>
              ) : isConnected ? (
                <>
                  <LuWifi size={14} aria-hidden="true" /> Connected
                </>
              ) : (
                <>
                  <LuWifi size={14} aria-hidden="true" /> Connecting…
                </>
              )}
            </span>
          </div>
          {error && (
            <div style={{ padding: '8px 0', fontSize: 13, color: '#ef4444' }}>
              {error}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeading>how to receive</PanelHeading>
          <p
            style={{
              fontSize: 14,
              color: 'var(--pizza-text-muted)',
              padding: '12px 0',
              lineHeight: 1.75,
            }}
          >
            Ask the sender to open{' '}
            <span
              style={{
                color: 'var(--pizza-accent-warm)',
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
              }}
            >
              www.cheezypizza.in
            </span>{' '}
            on the same network, drop their files, choose{' '}
            <strong style={{ color: 'var(--pizza-text)' }}>Local share</strong>,
            and select{' '}
            <strong style={{ color: 'var(--pizza-text)' }}>
              {myName ?? '…'}
            </strong>{' '}
            from the device list.
          </p>
        </Panel>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <BackButton href="/" label="Back" />

          <Link
            href="/"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Send files
            <LuArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PageLayout>
  )
}

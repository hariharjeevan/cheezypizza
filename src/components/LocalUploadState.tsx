'use client'

import React, { JSX, useCallback, useMemo, useRef, useState } from 'react'
import { UploadedFile } from '../types'
import { useLocalDiscovery, PeerInfo } from '../hooks/useLocalDiscovery'
import { useLocalUploader } from '../hooks/useLocalUploader'
import { useLocalDownloader } from '../hooks/useLocalDownloader'
import { getFileName } from '../fs'
import ProgressBar from './ProgressBar'
import Spinner from './Spinner'
import {
  LuArrowRight,
  LuFile,
  LuWifi,
  LuWifiOff,
  LuCheckCheck,
  LuTriangleAlert,
  LuArrowLeft,
  LuMonitor,
  LuSmartphone,
  LuTablet,
} from 'react-icons/lu'
import { useDeviceInfo } from '../hooks/useDeviceInfo'

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

// Device info

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

// Shared primitives

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
        padding: '10px 0',
        borderBottom: '1px solid var(--pizza-border)',
      }}
    >
      <span
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
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
        textTransform: 'uppercase' as const,
        color: 'var(--pizza-text-muted)',
        padding: '11px 0 9px',
        borderBottom: '1px solid var(--pizza-border)',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

function BackButton({
  onClick,
  label = 'Back',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      className="btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <LuArrowLeft size={14} aria-hidden="true" />
      {label}
    </button>
  )
}

// Tab shell

type LocalTab = 'send' | 'receive'

function LocalPageShell({
  activeTab,
  onTabChange,
  onBack,
  children,
}: {
  activeTab: LocalTab
  onTabChange: (tab: LocalTab) => void
  onBack: () => void
  children: React.ReactNode
}) {
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
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Spinner direction="up" />
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            marginTop: 32,
            marginBottom: 24,
            borderBottom: '1px solid var(--pizza-border)',
          }}
        >
          {(['send', 'receive'] as LocalTab[]).map((tab) => {
            const active = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active
                    ? '2px solid var(--pizza-accent)'
                    : '2px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase' as const,
                  color: active
                    ? 'var(--pizza-accent)'
                    : 'var(--pizza-text-muted)',
                  transition: 'color 0.15s, border-color 0.15s',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab === 'send' ? 'Send' : 'Receive'}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>

        {/* Footer back button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: 20,
          }}
        >
          <BackButton onClick={onBack} label="Back to home" />
        </div>
      </div>
    </div>
  )
}

// Send tab content

function SendTab({
  uploadedFiles,
  onDone,
}: {
  uploadedFiles: UploadedFile[]
  onDone: () => void
}) {
  const [selectedPeer, setSelectedPeer] = useState<PeerInfo | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const discovery = useLocalDiscovery({ onSelected: useCallback(() => {}, []) })
  const uploader = useLocalUploader()
  const { myId, myName, peers, isConnected, error } = discovery

  const otherPeers = useMemo(
    () => peers.filter((p) => p.id !== myId),
    [peers, myId],
  )

  const handlePickPeer = useCallback(
    (peer: PeerInfo) => {
      setSelectedPeer(peer)
      discovery.selectPeer(peer.id)
      discovery.startOffer(peer.id, (dc) => {
        dcRef.current = dc
        const files = uploadedFiles.map((f) => f as unknown as File)
        uploader.sendFiles(dc, files, () => {
          discovery.notifyTransferComplete(peer.id)
        })
      })
    },
    [discovery, uploadedFiles, uploader],
  )

  const handleReset = useCallback(() => {
    discovery.cleanup()
    uploader.cancel()
    setSelectedPeer(null)
  }, [discovery, uploader])

  const us = uploader.state

  // Peer selection

  if (!selectedPeer) {
    return (
      <>
        <Panel>
          <PanelHeading>your device</PanelHeading>
          <MetaRow label="name">
            <strong>{myName ?? '…'}</strong>
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
                  <LuWifi size={14} aria-hidden="true" /> Ready
                </>
              ) : (
                <>
                  <LuWifi size={14} aria-hidden="true" /> Connecting…
                </>
              )}
            </span>
          </div>
        </Panel>

        <Panel>
          <PanelHeading>
            {uploadedFiles.length}{' '}
            {uploadedFiles.length === 1 ? 'file' : 'files'} to send
          </PanelHeading>
          {uploadedFiles.map((f) => (
            <div
              key={getFileName(f)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid var(--pizza-border)',
              }}
            >
              <LuFile
                size={14}
                aria-hidden="true"
                style={{ flexShrink: 0, color: 'var(--pizza-text-muted)' }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  color: 'var(--pizza-text)',
                }}
              >
                {getFileName(f)}
              </span>
            </div>
          ))}
          <div style={{ height: 4 }} />
        </Panel>

        <Panel>
          <PanelHeading>Devices on your local network</PanelHeading>
          {otherPeers.length === 0 ? (
            <p
              style={{
                fontSize: 14,
                color: 'var(--pizza-text-muted)',
                padding: '16px 0',
                lineHeight: 1.6,
              }}
            >
              Waiting for a receiver to open CheezyPizza on the same network.
            </p>
          ) : (
            <>
              {otherPeers.map((peer) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => handlePickPeer(peer)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 0',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--pizza-border)',
                    cursor: 'pointer',
                    gap: 12,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--pizza-text)',
                    }}
                  >
                    {peer.name}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--pizza-accent)',
                      flexShrink: 0,
                    }}
                  >
                    Send <LuArrowRight size={12} aria-hidden="true" />
                  </span>
                </button>
              ))}
              <div style={{ height: 4 }} />
            </>
          )}
        </Panel>
      </>
    )
  }

  //Transfer state

  const totalBytes = us.status === 'transferring' ? us.totalBytes : 0
  const bytesSent = us.status === 'transferring' ? us.bytesSent : 0
  const isDone = us.status === 'done'
  const isError = us.status === 'error'
  const isTransferring = us.status === 'transferring'
  const isConnecting =
    us.status === 'waiting-for-accept' || us.status === 'connecting'

  return (
    <>
      <Panel>
        <PanelHeading>
          {isDone
            ? 'Transfer complete'
            : isError
              ? 'Transfer failed'
              : isTransferring
                ? 'Sending…'
                : 'Connecting…'}
        </PanelHeading>
        <MetaRow label="to">
          <strong>{selectedPeer.name}</strong>
        </MetaRow>
        <MetaRow label="files">{uploadedFiles.length}</MetaRow>
        {isTransferring && (
          <MetaRow label="sent">
            {formatBytes(bytesSent)} / {formatBytes(totalBytes)}
          </MetaRow>
        )}
        {isTransferring && (
          <MetaRow label="speed">
            {formatSpeed((us as { speedBps: number }).speedBps ?? 0)}
          </MetaRow>
        )}
        {isDone && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '10px 0',
              gap: 6,
              color: '#16a34a',
              fontSize: 14,
            }}
          >
            <LuCheckCheck size={16} aria-hidden="true" />
            <span>Delivered</span>
          </div>
        )}
        {isError && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '10px 0',
              gap: 6,
              color: '#ef4444',
              fontSize: 14,
            }}
          >
            <LuTriangleAlert size={15} aria-hidden="true" />
            <span style={{ textAlign: 'right', maxWidth: 300 }}>
              {(us as { message: string }).message}
            </span>
          </div>
        )}
      </Panel>

      {isTransferring && <ProgressBar value={bytesSent} max={totalBytes} />}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {isDone ? (
          <>
            <button onClick={handleReset} className="btn-secondary">
              Send to someone else
            </button>
            <button onClick={onDone} className="btn-primary">
              Done
            </button>
          </>
        ) : isError ? (
          <button onClick={handleReset} className="btn-secondary">
            Try again
          </button>
        ) : isConnecting ? (
          <BackButton onClick={handleReset} label="Cancel" />
        ) : (
          <BackButton onClick={handleReset} label="Cancel" />
        )}
      </div>
    </>
  )
}

// Receive tab content

function ReceiveTab() {
  const [senderName, setSenderName] = useState<string | null>(null)
  const downloader = useLocalDownloader()

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

  const handleCancel = useCallback(() => {
    downloader.cancel()
    discoveryRef.current?.cleanup()
    setSenderName(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dl.status === 'connecting') {
    return (
      <Panel>
        <PanelHeading>incoming transfer</PanelHeading>
        <MetaRow label="from">
          <strong>{senderName ?? '…'}</strong>
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
    )
  }

  if (dl.status === 'receiving') {
    return (
      <>
        <Panel>
          <PanelHeading>receiving</PanelHeading>
          <MetaRow label="from">
            <strong>{senderName ?? '…'}</strong>
          </MetaRow>
          <MetaRow label="file">
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 280,
                display: 'block',
              }}
            >
              {dl.fileName}
            </span>
          </MetaRow>
          <MetaRow label="received">
            {formatBytes(dl.bytesReceived)} / {formatBytes(dl.totalBytes)}
          </MetaRow>
          <MetaRow label="speed">{formatSpeed(dl.speedBps)}</MetaRow>
        </Panel>
        <ProgressBar value={dl.bytesReceived} max={dl.totalBytes} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleCancel} className="btn-secondary">
            Stop download
          </button>
        </div>
      </>
    )
  }

  if (dl.status === 'done') {
    return (
      <>
        <Panel>
          <PanelHeading>received</PanelHeading>
          <MetaRow label="from">
            <strong>{senderName ?? '…'}</strong>
          </MetaRow>
          <MetaRow label="files">{dl.fileNames.length}</MetaRow>
          {dl.fileNames.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 0',
                borderBottom: '1px solid var(--pizza-border)',
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
          <div style={{ height: 4 }} />
        </Panel>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleReset} className="btn-primary">
            Receive more
          </button>
        </div>
      </>
    )
  }

  if (dl.status === 'error') {
    return (
      <>
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
              size={15}
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <span style={{ lineHeight: 1.5 }}>{dl.message}</span>
          </div>
        </Panel>
        <button onClick={handleReset} className="btn-primary">
          Try again
        </button>
      </>
    )
  }

  // Idle / waiting
  return (
    <>
      <Panel>
        <PanelHeading>your device</PanelHeading>
        <MetaRow label="name">
          <strong>{myName ?? '…'}</strong>
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
          <p style={{ fontSize: 12, color: '#ef4444', paddingBottom: 8 }}>
            {error}
          </p>
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
          on the same network, drop their files, pick{' '}
          <strong style={{ color: 'var(--pizza-text)' }}>Local share</strong>,
          and select{' '}
          <strong style={{ color: 'var(--pizza-text)' }}>
            {myName ?? 'your device'}
          </strong>{' '}
          from the list.
        </p>
      </Panel>
    </>
  )
}

export default function LocalUploadState({
  uploadedFiles,
  onCancel,
  initialTab = 'send',
}: {
  uploadedFiles: UploadedFile[]
  onCancel: () => void
  initialTab?: LocalTab
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<LocalTab>(initialTab)

  return (
    <LocalPageShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onBack={onCancel}
    >
      {activeTab === 'send' ? (
        <SendTab uploadedFiles={uploadedFiles} onDone={onCancel} />
      ) : (
        <ReceiveTab />
      )}
    </LocalPageShell>
  )
}

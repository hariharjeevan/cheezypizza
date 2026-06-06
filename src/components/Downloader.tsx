'use client'

import React, { JSX, useState, useCallback, useEffect } from 'react'
import { useDownloader } from '../hooks/downloader/useDownloader'
import PasswordField from './PasswordField'
import UnlockButton from './UnlockButton'
import Loading from './Loading'
import UploadFileList from './UploadFileList'
import DownloadButton from './DownloadButton'
import StopButton from './StopButton'
import ProgressBar from './ProgressBar'
import TitleText from './TitleText'
import ReturnHome from './ReturnHome'
import { pluralize } from '../utils/pluralize'
import { ErrorMessage } from './ErrorMessage'
import PastePreviewModal, { isPasteFile } from './PastePreviewModal'

interface FileInfo {
  fileName: string
  size: number
  type: string
  sha256?: string
}

export function ConnectingToUploader({
  showTroubleshootingAfter = 3000,
}: {
  showTroubleshootingAfter?: number
}): JSX.Element {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTroubleshooting(true)
    }, showTroubleshootingAfter)
    return () => clearTimeout(timer)
  }, [showTroubleshootingAfter])

  if (!showTroubleshooting) {
    return <Loading text="Connecting to uploader..." />
  }

  return (
    <>
      <Loading text="Connecting to uploader..." />
      <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-stone-900 dark:text-stone-50">
          Having trouble connecting?
        </h2>
        <div className="space-y-4 text-stone-700 dark:text-stone-300">
          <p>
            FilePizza uses direct peer-to-peer connections, but sometimes the
            connection can get stuck. Here are some possible reasons this can
            happen:
          </p>
          <ul className="list-none space-y-3">
            <li className="flex items-start gap-3 px-4 py-2 rounded-lg bg-stone-100 dark:bg-stone-800">
              <span className="text-base">🚪</span>
              <span className="text-sm">
                The uploader may have closed their browser, lost connectivity,
                or stopped the upload. FilePizza requires the uploader to stay
                online continuously because files are transferred directly
                between browsers.
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-2 rounded-lg bg-stone-100 dark:bg-stone-800">
              <span className="text-base">🔒</span>
              <span className="text-sm">
                Your network might have strict firewalls or NAT settings, such
                as having UPnP disabled
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-2 rounded-lg bg-stone-100 dark:bg-stone-800">
              <span className="text-base">🌐</span>
              <span className="text-sm">
                Some corporate or school networks block peer-to-peer connections
              </span>
            </li>
          </ul>
        </div>
      </div>
      <ReturnHome />
    </>
  )
}

export function DownloadComplete({
  filesInfo,
  bytesDownloaded,
  totalSize,
}: {
  filesInfo: FileInfo[]
  bytesDownloaded: number
  totalSize: number
}): JSX.Element {
  return (
    <>
      <TitleText>
        You downloaded {pluralize(filesInfo.length, 'file', 'files')}.
      </TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesInfo} />
        {filesInfo.some((f) => f.sha256) && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              ✓ Integrity verified
            </p>
            <p className="text-xs text-green-700 dark:text-green-200">
              All files have been downloaded and verified against their SHA-256
              hashes.
            </p>
          </div>
        )}
        <div className="w-full">
          <ProgressBar value={bytesDownloaded} max={totalSize} />
        </div>
        <ReturnHome />
      </div>
    </>
  )
}

function formatSpeed(bps?: number): string {
  if (!bps || bps < 1024) return '--'
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
  return `${Math.round(bps / 1024)} KB/s`
}

function formatETA(seconds?: number): string {
  if (!seconds || !isFinite(seconds)) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function DownloadInProgress({
  filesInfo,
  bytesDownloaded,
  totalSize,
  onPause,
  onStop,
  speedBytesPerSec,
  etaSeconds,
  hashingProgress,
  isReconnecting,
  isStreaming,
}: {
  filesInfo: FileInfo[]
  bytesDownloaded: number
  totalSize: number
  onPause: () => void
  onStop: () => void
  speedBytesPerSec?: number
  etaSeconds?: number
  hashingProgress?: Record<string, number>
  isReconnecting?: boolean
  isStreaming?: boolean
}): JSX.Element {
  const filesWithHashProgress = filesInfo.map((f) => ({
    ...f,
    hashProgress: hashingProgress?.[f.fileName],
  }))

  return (
    <>
      <TitleText>
        You are downloading {pluralize(filesInfo.length, 'file', 'files')}.
      </TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesWithHashProgress} />
        <div className="w-full">
          <ProgressBar value={bytesDownloaded} max={totalSize} />
          <div className="mt-2 flex justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>
              {isReconnecting
                ? 'Reconnecting...'
                : formatSpeed(speedBytesPerSec)}
            </span>
            <span>{isReconnecting ? '' : formatETA(etaSeconds)}</span>
          </div>
        </div>
        {isReconnecting ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Connection interrupted — reconnecting and resuming your download…
            </p>
          </div>
        ) : (
          <p className="text-xs text-center text-stone-500 dark:text-stone-400">
            Your progress is saved — you can safely close this tab and resume
            later.
          </p>
        )}
        <div className="flex justify-center gap-3 w-full">
          {!isStreaming && (
            <button
              onClick={onPause}
              className="btn-secondary"
              disabled={isReconnecting}
            >
              Pause
            </button>
          )}
          <StopButton onClick={onStop} isDownloading />
        </div>
      </div>
    </>
  )
}

export function ResumePrompt({
  filesInfo,
  resumeOffsets,
  totalSize,
  onResume,
  onStartOver,
}: {
  filesInfo: FileInfo[]
  resumeOffsets: Record<string, number>
  totalSize: number
  onResume: () => void
  onStartOver: () => void
}): JSX.Element {
  const bytesAlreadyReceived = Object.values(resumeOffsets).reduce(
    (s, o) => s + o,
    0,
  )
  const percentage =
    totalSize > 0 ? Math.round((bytesAlreadyReceived / totalSize) * 100) : 0

  return (
    <>
      <TitleText>Resume your download?</TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesInfo} />
        <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 space-y-3">
          <p className="text-sm text-stone-700 dark:text-stone-300">
            You previously downloaded <strong>{percentage}%</strong> of this
            transfer. The uploader is still online — you can pick up where you
            left off.
          </p>
          <div className="w-full">
            <ProgressBar value={bytesAlreadyReceived} max={totalSize} />
          </div>
        </div>
        <div className="flex flex-col space-y-3">
          <DownloadButton onClick={onResume} label="Resume download" />
          <button onClick={onStartOver} className="btn-ghost">
            Start over from the beginning
          </button>
        </div>
      </div>
    </>
  )
}

export function ReadyToDownload({
  filesInfo,
  onStart,
}: {
  filesInfo: FileInfo[]
  onStart: () => void
}): JSX.Element {
  const isPaste = filesInfo.length === 1 && isPasteFile(filesInfo[0].fileName)

  return (
    <>
      <TitleText>
        {isPaste
          ? 'You have received a text snippet.'
          : `You are about to start downloading ${pluralize(filesInfo.length, 'file', 'files')}.`}
      </TitleText>
      <div className="flex flex-col space-y-5 w-full">
        {!isPaste && <UploadFileList files={filesInfo} />}
        <DownloadButton
          onClick={onStart}
          label={isPaste ? 'Receive snippet' : undefined}
        />
      </div>
    </>
  )
}

export function PasswordEntry({
  onSubmit,
  errorMessage,
}: {
  onSubmit: (password: string) => void
  errorMessage: string | null
}): JSX.Element {
  const [password, setPassword] = useState('')
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSubmit(password)
    },
    [onSubmit, password],
  )

  return (
    <>
      <TitleText>This download requires a password.</TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <form
          action="#"
          method="post"
          onSubmit={handleSubmit}
          className="w-full"
        >
          <div className="flex flex-col space-y-5 w-full">
            <PasswordField
              value={password}
              onChange={setPassword}
              isRequired
              isInvalid={Boolean(errorMessage)}
            />
            <UnlockButton />
          </div>
        </form>
      </div>
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </>
  )
}

export function QuotaExceeded({
  filesInfo,
  onStreamingDownload,
  onStop,
}: {
  filesInfo: FileInfo[]
  onStreamingDownload: () => void
  onStop: () => void
}): JSX.Element {
  return (
    <>
      <TitleText>Not enough storage space.</TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesInfo} />
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Your browser doesn&apos;t have enough quota to store this download.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            You can still download directly to your device — the file will be
            saved straight to disk as it arrives. This skips resume support, so
            keep this tab open until the download finishes.
          </p>
        </div>
        <DownloadButton
          onClick={onStreamingDownload}
          label="Download directly to disk"
        />
        <button onClick={onStop} className="btn-ghost">
          Cancel
        </button>
      </div>
    </>
  )
}

export default function Downloader({
  uploaderPeerID,
}: {
  uploaderPeerID: string
}): JSX.Element {
  const {
    filesInfo,
    isPasswordRequired,
    isDownloading,
    isPaused,
    isDone,
    errorMessage,
    fileErrors,
    resumeOffsets,
    submitPassword,
    startDownload,
    pauseDownload,
    stopDownload,
    saveFiles,
    hasPendingDownload,
    totalSize,
    bytesDownloaded,
    verifiedHashes,
    computedHashes,
    isVerifying,
    isWaitingForUploaderHash,
    hashingProgress,
    speedBytesPerSec,
    etaSeconds,
    readPasteBlob,
    quotaExceeded,
    startStreamingDownload,
    isReconnecting,
    isStreamingDownload,
  } = useDownloader(uploaderPeerID)

  const [ignoreSavedProgress, setIgnoreSavedProgress] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)

  // Auto-open paste modal once transfer is done and it's a paste file
  const isPasteTransfer =
    filesInfo?.length === 1 && isPasteFile(filesInfo[0].fileName)

  useEffect(() => {
    if (isDone && isPasteTransfer && !showPasteModal) {
      setShowPasteModal(true)
    }
  }, [isDone, isPasteTransfer])

  const hasResumableProgress =
    !ignoreSavedProgress && Object.values(resumeOffsets).some((o) => o > 0)

  const handleStartOver = useCallback(async () => {
    await stopDownload()
    setIgnoreSavedProgress(true)
    startDownload()
  }, [stopDownload, startDownload])

  const handleSaveFiles = useCallback(async () => {
    await saveFiles()
    setIsSaved(true)
  }, [saveFiles])

  const filesWithComputedHashes = filesInfo?.map((f) => ({
    ...f,
    computedSha256: computedHashes[f.fileName],
  }))

  const isLocallyHashing = Object.keys(hashingProgress).length > 0

  if (isLocallyHashing && filesWithComputedHashes && filesInfo) {
    const filesWithHashProgress = filesWithComputedHashes.map((f) => ({
      ...f,
      hashProgress: hashingProgress[f.fileName],
    }))

    let totalHashBytes = 0
    let hashedBytes = 0
    for (const f of filesInfo) {
      totalHashBytes += f.size
      hashedBytes += f.size * (hashingProgress[f.fileName] ?? 0)
    }
    const weightedHashProgress =
      totalHashBytes > 0 ? hashedBytes / totalHashBytes : 0
    const hashPercentage = Math.round(weightedHashProgress * 100)

    const filesHashing = filesWithHashProgress.filter(
      (f) => typeof f.hashProgress === 'number' && (f.hashProgress ?? 0) < 1,
    ).length
    const filesHashed = filesWithHashProgress.filter(
      (f) => (f.hashProgress ?? 0) >= 1,
    ).length

    return (
      <>
        <TitleText>Verifying file integrity...</TitleText>
        <div className="flex flex-col space-y-5 w-full">
          <UploadFileList files={filesWithHashProgress} />
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex-1">
                <p className="text-sm text-teal-800 dark:text-teal-200">
                  Computing SHA-256 checksum to verify file integrity…
                </p>
                <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                  {filesHashed > 0 &&
                    `${filesHashed} ${filesHashed === 1 ? 'file' : 'files'} done, `}
                  {filesHashing > 0 &&
                    `${filesHashing} ${filesHashing === 1 ? 'file' : 'files'} hashing`}
                </p>
              </div>
              <span className="text-xs font-medium text-teal-700 dark:text-teal-100 whitespace-nowrap">
                {hashPercentage}%
              </span>
            </div>
            <ProgressBar value={hashPercentage} max={100} />
          </div>
        </div>
      </>
    )
  }

  if (isWaitingForUploaderHash && filesWithComputedHashes) {
    return (
      <>
        <TitleText>Verifying file integrity...</TitleText>
        <div className="flex flex-col space-y-5 w-full">
          <UploadFileList files={filesWithComputedHashes} />
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Waiting for uploader to finish computing checksum…
              </p>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-100">
                100%
              </span>
            </div>
            <ProgressBar value={100} max={100} />
          </div>
        </div>
      </>
    )
  }

  if (isVerifying && filesWithComputedHashes) {
    return (
      <>
        <TitleText>Verifying file integrity...</TitleText>
        <div className="flex flex-col space-y-5 w-full">
          <UploadFileList files={filesWithComputedHashes} />
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Verifying file integrity…
              </p>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-100">
                100%
              </span>
            </div>
            <ProgressBar value={100} max={100} />
          </div>
        </div>
      </>
    )
  }

  // Paste transfer complete — show modal, no save button needed
  if (isDone && isPasteTransfer && filesInfo) {
    return (
      <>
        <TitleText>Text snippet received.</TitleText>
        <div className="flex flex-col space-y-5 w-full items-center">
          <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
            The snippet is ready to copy.
          </p>
          <button
            onClick={() => setShowPasteModal(true)}
            className="btn-primary"
          >
            View & Copy
          </button>
          <ReturnHome />
        </div>
        {showPasteModal && (
          <PastePreviewModal
            readPasteBlob={readPasteBlob}
            onClose={() => setShowPasteModal(false)}
          />
        )}
      </>
    )
  }

  // Regular transfer complete — ready to save
  if (isDone && filesInfo && !isSaved) {
    const hasErrors = Object.keys(fileErrors).length > 0

    return (
      <>
        <TitleText>
          {pluralize(filesInfo.length, 'File', 'Files')} ready to save.
        </TitleText>
        <div className="flex flex-col space-y-5 w-full">
          <UploadFileList
            files={filesWithComputedHashes!.map((f) => ({
              ...f,
              sha256: verifiedHashes[f.fileName],
            }))}
          />
          {filesInfo.some((f) => verifiedHashes[f.fileName]) && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                ✓ Integrity verified
              </p>
              <p className="text-xs text-green-700 dark:text-green-200 mt-1">
                Verified files are ready to save.
              </p>
            </div>
          )}
          {hasErrors && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Some files failed integrity verification.
              </p>
              <ul className="space-y-2 text-xs text-amber-800 dark:text-amber-200">
                {Object.entries(fileErrors).map(([fileName, reason]) => (
                  <li key={fileName}>
                    <span className="font-medium">{fileName}:</span> {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasPendingDownload ? (
            <DownloadButton
              onClick={handleSaveFiles}
              label={`Save ${pluralize(filesInfo.length, 'file', 'files')} to device`}
            />
          ) : (
            <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-4 text-sm text-stone-600 dark:text-stone-300">
              No files are available to save because integrity verification
              failed.
            </div>
          )}
        </div>
      </>
    )
  }

  if (isDone && isSaved && filesInfo) {
    return (
      <DownloadComplete
        filesInfo={filesInfo.map((f) => ({
          ...f,
          sha256: verifiedHashes[f.fileName],
        }))}
        bytesDownloaded={bytesDownloaded}
        totalSize={totalSize}
      />
    )
  }

  if (isPasswordRequired) {
    return (
      <PasswordEntry errorMessage={errorMessage} onSubmit={submitPassword} />
    )
  }

  // Quota-exceeded — offer streaming fallback before showing error
  if (quotaExceeded && filesInfo) {
    return (
      <QuotaExceeded
        filesInfo={filesInfo}
        onStreamingDownload={startStreamingDownload}
        onStop={stopDownload}
      />
    )
  }

  if (errorMessage) {
    return (
      <>
        <ErrorMessage message={errorMessage} />
        <ReturnHome />
      </>
    )
  }

  if (isDownloading && filesInfo) {
    return (
      <DownloadInProgress
        filesInfo={filesInfo}
        bytesDownloaded={bytesDownloaded}
        totalSize={totalSize}
        onPause={pauseDownload}
        onStop={stopDownload}
        speedBytesPerSec={speedBytesPerSec}
        etaSeconds={etaSeconds}
        hashingProgress={hashingProgress}
        isReconnecting={isReconnecting}
        isStreaming={isStreamingDownload}
      />
    )
  }

  if (filesInfo && (hasResumableProgress || isPaused)) {
    return (
      <ResumePrompt
        filesInfo={filesInfo}
        resumeOffsets={resumeOffsets}
        totalSize={totalSize}
        onResume={startDownload}
        onStartOver={handleStartOver}
      />
    )
  }

  if (filesInfo) {
    return <ReadyToDownload filesInfo={filesInfo} onStart={startDownload} />
  }

  if (!filesInfo) {
    return <ConnectingToUploader />
  }

  return <Loading text="Uh oh... Something went wrong." />
}

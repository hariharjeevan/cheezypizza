'use client'

import React, { JSX, useState, useCallback, useEffect } from 'react'
import { useDownloader } from '../hooks/useDownloader'
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

export function DownloadInProgress({
  filesInfo,
  bytesDownloaded,
  totalSize,
  onPause,
  onStop,
}: {
  filesInfo: FileInfo[]
  bytesDownloaded: number
  totalSize: number
  onPause: () => void
  onStop: () => void
}): JSX.Element {
  return (
    <>
      <TitleText>
        You are downloading {pluralize(filesInfo.length, 'file', 'files')}.
      </TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesInfo} />
        <div className="w-full">
          <ProgressBar value={bytesDownloaded} max={totalSize} />
        </div>
        <p className="text-xs text-center text-stone-500 dark:text-stone-400">
          Your progress is saved — you can safely close this tab and resume
          later.
        </p>
        <div className="flex justify-center gap-3 w-full">
          <button
            onClick={onPause}
            className="px-4 py-2 rounded-md text-sm font-medium bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-100 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
          >
            Pause
          </button>
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
          <button
            onClick={onStartOver}
            className="text-sm text-stone-500 dark:text-stone-400 underline underline-offset-2 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
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
  return (
    <>
      <TitleText>
        You are about to start downloading{' '}
        {pluralize(filesInfo.length, 'file', 'files')}.
      </TitleText>
      <div className="flex flex-col space-y-5 w-full">
        <UploadFileList files={filesInfo} />
        <DownloadButton onClick={onStart} />
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
    resumeOffsets,
    submitPassword,
    startDownload,
    pauseDownload,
    stopDownload,
    totalSize,
    bytesDownloaded,
    verifiedHashes,
  } = useDownloader(uploaderPeerID)

  const [ignoreSavedProgress, setIgnoreSavedProgress] = useState(false)

  const hasResumableProgress =
    !ignoreSavedProgress && Object.values(resumeOffsets).some((o) => o > 0)

  const handleStartOver = useCallback(async () => {
    await stopDownload()
    setIgnoreSavedProgress(true)
    startDownload()
  }, [stopDownload, startDownload])

  if (isDone && filesInfo) {
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
      />
    )
  }

  // Show resume prompt after a pause or when persisted progress exists
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

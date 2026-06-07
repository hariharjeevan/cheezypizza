'use client'

import React, { JSX, useCallback, useMemo, useState } from 'react'
import WebRTCPeerProvider from '../components/WebRTCProvider'
import DropZone from '../components/DropZone'
import UploadFileList from '../components/UploadFileList'
import Uploader from '../components/Uploader'
import PasswordField from '../components/PasswordField'
import StartButton from '../components/StartButton'
import { UploadedFile } from '../types'
import Spinner from '../components/Spinner'
import CancelButton from '../components/CancelButton'
import { getFileName } from '../fs'
import TitleText from '../components/TitleText'
import SubtitleText from '../components/SubtitleText'
import { pluralize } from '../utils/pluralize'
import TermsAcceptance from '../components/TermsAcceptance'
import AddFilesButton from '../components/AddFilesButton'
import FeatureMenu from '../components/FeatureMenu'
import StatsBar from '../components/StatsBar'
import WhatIsCheezyPizza from '../components/WhatIsCheezyPizza'

function PageWrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{ minHeight: '600px' }}
      className="flex flex-col items-center justify-start"
    >
      <div className="flex flex-col items-center space-y-5 py-10 max-w-4xl w-full mx-auto px-4">
        <Spinner direction="up" />
        {children}
      </div>
    </div>
  )
}

function InitialState({
  onDrop,
}: {
  onDrop: (files: UploadedFile[]) => void
}): JSX.Element {
  return (
    <PageWrapper>
      <div className="flex flex-col items-center space-y-1 max-w-md">
        <TitleText>Peer-to-peer file transfers in your browser.</TitleText>
      </div>
      <DropZone onDrop={onDrop} />
      <TermsAcceptance />
      <StatsBar />
      <div className="flex flex-col lg:flex-row lg:items-start gap-5 w-full max-w-4xl">
        <div className="flex-1 min-w-0">
          <WhatIsCheezyPizza />
        </div>
        <div className="flex-1 min-w-0">
          <FeatureMenu />
        </div>
      </div>
    </PageWrapper>
  )
}

function useUploaderFileListData(uploadedFiles: UploadedFile[]) {
  return useMemo(() => {
    return uploadedFiles.map((item) => ({
      fileName: getFileName(item),
      type: item.type,
    }))
  }, [uploadedFiles])
}

function ConfirmUploadState({
  uploadedFiles,
  password,
  onChangePassword,
  onCancel,
  onStart,
  onRemoveFile,
  onAddFiles,
}: {
  uploadedFiles: UploadedFile[]
  password: string
  onChangePassword: (pw: string) => void
  onCancel: () => void
  onStart: () => void
  onRemoveFile: (index: number) => void
  onAddFiles: (files: UploadedFile[]) => void
}): JSX.Element {
  const fileListData = useUploaderFileListData(uploadedFiles)
  return (
    <PageWrapper>
      <TitleText>
        You are about to start uploading{' '}
        {pluralize(uploadedFiles.length, 'file', 'files')}.{' '}
        <AddFilesButton onAdd={onAddFiles} />
      </TitleText>
      <UploadFileList files={fileListData} onRemove={onRemoveFile} />
      <PasswordField value={password} onChange={onChangePassword} />
      <div className="flex space-x-4">
        <CancelButton onClick={onCancel} />
        <StartButton onClick={onStart} />
      </div>
    </PageWrapper>
  )
}

function UploadingState({
  uploadedFiles,
  password,
  onStop,
}: {
  uploadedFiles: UploadedFile[]
  password: string
  onStop: () => void
}): JSX.Element {
  return (
    <PageWrapper>
      <TitleText>
        You are uploading {pluralize(uploadedFiles.length, 'file', 'files')}.
      </TitleText>
      <SubtitleText>
        Leave this tab open. CheezyPizza does not store files.
      </SubtitleText>
      <WebRTCPeerProvider>
        <Uploader files={uploadedFiles} password={password} onStop={onStop} />
      </WebRTCPeerProvider>
    </PageWrapper>
  )
}

export default function UploadPage(): JSX.Element {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [password, setPassword] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleDrop = useCallback((files: UploadedFile[]): void => {
    setUploadedFiles(files)
  }, [])

  const handleChangePassword = useCallback((pw: string) => {
    setPassword(pw)
  }, [])

  const handleStart = useCallback(() => {
    setUploading(true)
  }, [])

  const handleStop = useCallback(() => {
    setUploading(false)
  }, [])

  const handleCancel = useCallback(() => {
    setUploadedFiles([])
    setUploading(false)
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((fs) => fs.filter((_, i) => i !== index))
  }, [])

  const handleAddFiles = useCallback((files: UploadedFile[]) => {
    setUploadedFiles((fs) => [...fs, ...files])
  }, [])

  if (!uploadedFiles.length) {
    return <InitialState onDrop={handleDrop} />
  }

  if (!uploading) {
    return (
      <ConfirmUploadState
        uploadedFiles={uploadedFiles}
        password={password}
        onChangePassword={handleChangePassword}
        onCancel={handleCancel}
        onStart={handleStart}
        onRemoveFile={handleRemoveFile}
        onAddFiles={handleAddFiles}
      />
    )
  }

  return (
    <UploadingState
      uploadedFiles={uploadedFiles}
      password={password}
      onStop={handleStop}
    />
  )
}

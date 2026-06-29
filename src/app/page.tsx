// src/app/page.tsx
'use client'

import React, { JSX, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import DropZone from '../components/DropZone'
import Spinner from '../components/Spinner'
import TitleText from '../components/TitleText'
import TermsAcceptance from '../components/TermsAcceptance'
import StatsBar from '../components/StatsBar'
import WhatIsCheezyPizza from '../components/WhatIsCheezyPizza'
import FeatureMenu from '../components/FeatureMenu'
import PressFeature from '../components/PressFeature'
import FAQ from '../components/FAQ'
import HelpUs from '../components/HelpUs'
import LocalUploadState from '../components/LocalUploadState'
import ShareModePicker from '../components/ShareModePicker'
import ConfirmUploadState from '../components/ConfirmUploadState'
import UploadingState from '../components/UploadingState'
import { UploadedFile } from '../types'

type PageStep =
  | 'initial'
  | 'share-mode'
  | 'internet-confirm'
  | 'internet-uploading'
  | 'local'

export default function UploadPage(): JSX.Element {
  const [step, setStep] = useState<PageStep>('initial')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleDrop = useCallback((files: UploadedFile[]): void => {
    setUploadedFiles(files)
    setStep('share-mode')
  }, [])

  const handleReceiveLocally = useCallback(() => {
    router.push('/local')
  }, [router])

  const handlePickInternet = useCallback(() => setStep('internet-confirm'), [])
  const handlePickLocal = useCallback(() => setStep('local'), [])

  const handleStart = useCallback(() => setStep('internet-uploading'), [])
  const handleStop = useCallback(() => setStep('internet-confirm'), [])

  const handleCancel = useCallback(() => {
    setUploadedFiles([])
    setPassword('')
    setStep('initial')
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((fs) => {
      const next = fs.filter((_, i) => i !== index)
      if (next.length === 0) setStep('initial')
      return next
    })
  }, [])

  const handleAddFiles = useCallback((files: UploadedFile[]) => {
    setUploadedFiles((fs) => [...fs, ...files])
  }, [])

  if (step === 'share-mode') {
    return (
      <ShareModePicker
        uploadedFiles={uploadedFiles}
        onPickInternet={handlePickInternet}
        onPickLocal={handlePickLocal}
        onCancel={handleCancel}
      />
    )
  }

  if (step === 'internet-confirm') {
    return (
      <ConfirmUploadState
        uploadedFiles={uploadedFiles}
        password={password}
        onChangePassword={setPassword}
        onCancel={handleCancel}
        onStart={handleStart}
        onRemoveFile={handleRemoveFile}
        onAddFiles={handleAddFiles}
      />
    )
  }

  if (step === 'internet-uploading') {
    return (
      <UploadingState
        uploadedFiles={uploadedFiles}
        password={password}
        onStop={handleStop}
      />
    )
  }

  if (step === 'local') {
    return (
      <LocalUploadState
        uploadedFiles={uploadedFiles}
        onCancelAction={handleCancel}
      />
    )
  }

  // step === 'initial'
  return (
    <div
      style={{ minHeight: '600px' }}
      className="flex flex-col items-center justify-start"
    >
      <div className="flex flex-col items-center space-y-5 py-10 max-w-4xl w-full mx-auto px-4">
        <Spinner direction="up" />
        <div className="flex flex-col items-center space-y-1 max-w-md">
          <TitleText>Peer-to-peer file transfers in your browser.</TitleText>
        </div>
        <DropZone
          onDropAction={handleDrop}
          onReceiveLocallyAction={handleReceiveLocally}
        />
        <TermsAcceptance />
        <StatsBar />
        <div className="flex flex-col lg:flex-row gap-5 w-full max-w-4xl">
          <div className="flex-1 min-w-0">
            <WhatIsCheezyPizza />
          </div>
          <div className="flex-1 min-w-0">
            <FeatureMenu />
          </div>
        </div>
        <PressFeature />
        <FAQ />
        <HelpUs />
      </div>
    </div>
  )
}

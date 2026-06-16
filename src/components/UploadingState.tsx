import React, { JSX } from 'react'
import TitleText from '../components/TitleText'
import Uploader from '../components/Uploader'
import WebRTCPeerProvider from '../components/WebRTCProvider'
import PageWrapper from './PageWrapper'
import { UploadedFile } from '../types'
import { pluralize } from '../utils/pluralize'

export default function UploadingState({
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
        Uploading {pluralize(uploadedFiles.length, 'file', 'files')}...
      </TitleText>
      <WebRTCPeerProvider>
        <Uploader files={uploadedFiles} password={password} onStop={onStop} />
      </WebRTCPeerProvider>
    </PageWrapper>
  )
}

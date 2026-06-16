import React, { JSX, useMemo } from 'react'
import TitleText from '../components/TitleText'
import UploadFileList from '../components/UploadFileList'
import PasswordField from '../components/PasswordField'
import StartButton from '../components/StartButton'
import CancelButton from '../components/CancelButton'
import AddFilesButton from '../components/AddFilesButton'
import PageWrapper from './PageWrapper'
import { UploadedFile } from '../types'
import { getFileName } from '../fs'
import { pluralize } from '../utils/pluralize'

function useUploaderFileListData(uploadedFiles: UploadedFile[]) {
  return useMemo(() => {
    return uploadedFiles.map((item) => ({
      fileName: getFileName(item),
      type: item.type,
    }))
  }, [uploadedFiles])
}

export default function ConfirmUploadState({
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

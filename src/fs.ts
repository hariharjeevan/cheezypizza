import { UploadedFile } from './types'

const getAsFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file((file: UploadedFile) => {
      file.entryFullPath = entry.fullPath
      resolve(file)
    }, reject)
  })

const readDirectoryEntries = (
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> =>
  new Promise((resolve, reject) => {
    reader.readEntries((entries) => {
      resolve(entries)
    }, reject)
  })

function isDirectoryEntry(
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return !entry.isDirectory
}

const scanDirectoryEntry = async (
  entry: FileSystemDirectoryEntry,
): Promise<File[]> => {
  const directoryReader = entry.createReader()
  const result: File[] = []

  while (true) {
    const subentries = await readDirectoryEntries(directoryReader)
    if (!subentries.length) {
      return result
    }

    for (const se of subentries) {
      if (isDirectoryEntry(se)) {
        const ses = await scanDirectoryEntry(se)
        result.push(...ses)
      } else if (isFileEntry(se)) {
        const file = await getAsFile(se)
        result.push(file)
      }
    }
  }
}

export const extractFileList = async (
  e: React.DragEvent | DragEvent,
): Promise<File[]> => {
  if (!e.dataTransfer || !e.dataTransfer.items.length) {
    return []
  }

  const items = e.dataTransfer.items
  const scans: Promise<File[]>[] = []
  const files: Promise<File>[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = item.webkitGetAsEntry()
    if (entry) {
      if (isDirectoryEntry(entry)) {
        scans.push(scanDirectoryEntry(entry))
      } else if (isFileEntry(entry)) {
        files.push(getAsFile(entry))
      }
    }
  }

  const scanResults = await Promise.all(scans)
  const fileResults = await Promise.all(files)

  return scanResults.flat().concat(fileResults)
}

// Borrowed from StackOverflow
// http://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
export const formatSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1000
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toPrecision(3)} ${sizes[i]}`
}

export const getFileName = (file: UploadedFile): string => {
  return file.name ?? file.entryFullPath ?? ''
}

import { Page, Browser, expect } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface TestFile {
  name: string
  content: string
  path: string
  checksum: string
}

export function createTestFile(fileName: string, content: string): TestFile {
  const dir = join(tmpdir(), `cheezypizza-${randomBytes(6).toString('hex')}`)
  mkdirSync(dir, { recursive: true })

  const testFilePath = join(dir, fileName)
  writeFileSync(testFilePath, content)

  const checksum = createHash('sha256').update(content).digest('hex')

  return { name: fileName, content, path: testFilePath, checksum }
}

export async function uploadFile(page: Page, testFile: TestFile): Promise<void> {
  await page.goto('http://127.0.0.1:3000/')
  await expect(page.getByText('Peer-to-peer file transfers in your browser.')).toBeVisible()
  await expect(page.getByRole('button', { name: /select file/i })).toBeVisible()

  await page.setInputFiles('input[type="file"]', testFile.path)

  await page.getByRole('button', { name: /internet share/i }).click()

  await expect(page.getByText(testFile.name)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/You are about to start uploading/i)).toBeVisible({ timeout: 10000 })
}

export async function addFile(page: Page, testFile: TestFile): Promise<void> {
  await expect(page.locator('#add-files-input')).toBeAttached({ timeout: 5000 })
  await page.setInputFiles('#add-files-input', testFile.path)
  await expect(page.getByText(testFile.name)).toBeVisible({ timeout: 5000 })
}

export async function startUpload(page: Page): Promise<string> {
  await page.locator('#start-button').click()

  const shareUrlInput = page.locator('#copyable-input-long-url')
  await expect(shareUrlInput).toBeVisible({ timeout: 10000 })
  const shareUrl = await shareUrlInput.inputValue()

  expect(shareUrl).toMatch(/http:\/\/127.0.0.1:3000\//)
  return shareUrl
}

export async function downloadFile(
  page: Page,
  shareUrl: string,
  testFile: TestFile,
): Promise<void> {
  await page.goto(shareUrl)

  await expect(page.getByText(testFile.name)).toBeVisible({ timeout: 10000 })
  await expect(page.locator('#download-button')).toBeVisible({ timeout: 10000 })

  // Start the transfer
  await page.locator('#download-button').click()

  await expect(page.getByText(/file ready to save/i)).toBeVisible({ timeout: 30000 })

  await page.locator('#download-button').click()

  await expect(page.getByText(/You downloaded/i)).toBeVisible({ timeout: 10000 })
}

export async function verifyTransferCompletion(downloaderPage: Page): Promise<void> {
  await expect(downloaderPage.getByText(/You downloaded/i)).toBeVisible({ timeout: 10000 })
}

export async function createBrowserContexts(browser: Browser): Promise<{
  uploaderPage: Page
  downloaderPage: Page
  cleanup: () => Promise<void>
}> {
  const uploaderContext = await browser.newContext()
  const downloaderContext = await browser.newContext()

  await downloaderContext.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: undefined,
      writable: false,
    })
  })

  const uploaderPage = await uploaderContext.newPage()
  const downloaderPage = await downloaderContext.newPage()

  const cleanup = async () => {
    await uploaderContext.close().catch(() => {})
    await downloaderContext.close().catch(() => {})
  }

  return { uploaderPage, downloaderPage, cleanup }
}

export interface ChunkProgressLog {
  chunkNumber: number
  fileName: string
  offset: number
  end: number
  fileSize: number
  final: boolean
  progressPercentage: number
  side: 'upload' | 'download'
}

export interface PreciseChunkMonitor {
  uploadChunks: ChunkProgressLog[]
  downloadChunks: ChunkProgressLog[]
}

export function monitorChunkProgress(
  uploaderPage: Page,
  downloaderPage: Page,
  expectedFileSize: number,
): { getChunks: () => PreciseChunkMonitor } {
  const uploadChunks: ChunkProgressLog[] = []
  const downloadChunks: ChunkProgressLog[] = []

  uploaderPage.on('console', (msg) => {
    const text = msg.text()
    if (!text.includes('[UploaderConnections] received chunk ack')) return

    const ackMatch = text.match(/received chunk ack: (\S+) offset (\d+) bytes (\d+)/)
    if (!ackMatch) return

    const [, fileName, offset, bytes] = ackMatch
    const chunkEnd = parseInt(offset) + parseInt(bytes)

    uploadChunks.push({
      chunkNumber: Math.floor(parseInt(offset) / (256 * 1024)) + 1,
      fileName,
      offset: parseInt(offset),
      end: chunkEnd,
      fileSize: expectedFileSize,
      final: chunkEnd >= expectedFileSize,
      progressPercentage: Math.round((chunkEnd / expectedFileSize) * 100),
      side: 'upload',
    })
  })

  downloaderPage.on('console', (msg) => {
    const text = msg.text()
    if (!text.includes('[Downloader] received chunk') || text.includes('finished receiving')) return

    const chunkMatch = text.match(/received chunk (\d+) for (\S+) \((\d+)-(\d+)\) final=(\w+)/)
    if (!chunkMatch) return

    const [, chunkNum, fileName, offset, end, final] = chunkMatch
    const chunkEnd = parseInt(end)

    downloadChunks.push({
      chunkNumber: parseInt(chunkNum),
      fileName,
      offset: parseInt(offset),
      end: chunkEnd,
      fileSize: expectedFileSize,
      final: final === 'true',
      progressPercentage: Math.round((chunkEnd / expectedFileSize) * 100),
      side: 'download',
    })
  })

  return { getChunks: () => ({ uploadChunks, downloadChunks }) }
}

export function verifyPreciseProgress(
  chunks: ChunkProgressLog[],
  expectedChunks: number,
  side: 'upload' | 'download',
): void {
  expect(chunks.length).toBe(expectedChunks)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    expect(chunk.chunkNumber).toBe(i + 1)

    if (i > 0) {
      expect(chunk.progressPercentage).toBeGreaterThanOrEqual(chunks[i - 1].progressPercentage)
    }

    if (chunk.final) {
      expect(chunk.progressPercentage).toBe(100)
    }

    expect(chunk.progressPercentage).toBeGreaterThanOrEqual(0)
    expect(chunk.progressPercentage).toBeLessThanOrEqual(100)
  }
}
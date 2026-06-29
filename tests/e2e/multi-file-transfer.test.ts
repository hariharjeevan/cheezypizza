/// <reference types="@playwright/test" />
import { test, expect } from '@playwright/test'
import {
  createTestFile,
  uploadFile,
  addFile,
  startUpload,
  createBrowserContexts,
  TestFile,
} from './helpers'

// Helper: navigate to share URL and wait until all file names are listed.
async function navigateToDownloadPage(
  page: import('@playwright/test').Page,
  shareUrl: string,
  files: TestFile[],
): Promise<void> {
  await page.goto(shareUrl)
  for (const file of files) {
    await expect(page.getByText(file.name)).toBeVisible({ timeout: 10000 })
  }
  await expect(page.locator('#download-button')).toBeVisible({ timeout: 10000 })
}

// Helper: click Download, wait for in-progress state, then wait for
// "Files ready to save." (post-transfer, pre-save state).
async function runMultiFileTransfer(
  page: import('@playwright/test').Page,
  files: TestFile[],
): Promise<void> {
  await page.locator('#download-button').click()

  // Should transition to "downloading N files"
  await expect(
    page.getByText(new RegExp(`downloading ${files.length} file`, 'i')),
  ).toBeVisible({ timeout: 15000 })

  await expect(
    page.getByText(/files? ready to save/i),
  ).toBeVisible({ timeout: 30000 })
}

async function saveMultiFileZip(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('#download-button').click()
  await expect(page.getByText(/You downloaded/i)).toBeVisible({ timeout: 15000 })
}

async function verifyMultiFileCompletion(
  page: import('@playwright/test').Page,
  expectedCount: number,
): Promise<void> {
  await expect(
    page.getByText(new RegExp(`You downloaded ${expectedCount} files`, 'i')),
  ).toBeVisible({ timeout: 10000 })
}

// Tests
test('multi-file transfer: two small files', async ({ browser }) => {
  const file1 = createTestFile('alpha.txt', 'A'.repeat(1024))
  const file2 = createTestFile('beta.txt', 'B'.repeat(2048))

  const { uploaderPage, downloaderPage, cleanup } = await createBrowserContexts(browser)

  try {
    await uploadFile(uploaderPage, file1)
    await addFile(uploaderPage, file2)

    const shareUrl = await startUpload(uploaderPage)

    await navigateToDownloadPage(downloaderPage, shareUrl, [file1, file2])
    await runMultiFileTransfer(downloaderPage, [file1, file2])
    await saveMultiFileZip(downloaderPage)
    await verifyMultiFileCompletion(downloaderPage, 2)

    // Both filenames should still be visible in the completion screen
    await expect(downloaderPage.getByText(file1.name)).toBeVisible()
    await expect(downloaderPage.getByText(file2.name)).toBeVisible()
  } finally {
    await cleanup()
  }
})

test('multi-file transfer: three files of varying sizes', async ({ browser }) => {
  const CHUNK = 64 * 1024
  const file1 = createTestFile('small.txt', 'S'.repeat(Math.floor(CHUNK * 0.5)))
  const file2 = createTestFile('medium.txt', 'M'.repeat(Math.floor(CHUNK * 2.5)))
  const file3 = createTestFile('large.txt', 'L'.repeat(Math.floor(CHUNK * 4)))

  const { uploaderPage, downloaderPage, cleanup } = await createBrowserContexts(browser)

  try {
    await uploadFile(uploaderPage, file1)
    await addFile(uploaderPage, file2)
    await addFile(uploaderPage, file3)

    const shareUrl = await startUpload(uploaderPage)

    await navigateToDownloadPage(downloaderPage, shareUrl, [file1, file2, file3])
    await runMultiFileTransfer(downloaderPage, [file1, file2, file3])
    await saveMultiFileZip(downloaderPage)
    await verifyMultiFileCompletion(downloaderPage, 3)
  } finally {
    await cleanup()
  }
})

test('multi-file transfer: uploader sees all files listed before starting', async ({ browser }) => {
  const file1 = createTestFile('one.txt', 'X'.repeat(512))
  const file2 = createTestFile('two.txt', 'Y'.repeat(512))

  const { uploaderPage, downloaderPage, cleanup } = await createBrowserContexts(browser)

  try {
    await uploadFile(uploaderPage, file1)
    await addFile(uploaderPage, file2)

    // Both files visible in pre-upload UI
    await expect(uploaderPage.getByText(file1.name)).toBeVisible()
    await expect(uploaderPage.getByText(file2.name)).toBeVisible()

    const shareUrl = await startUpload(uploaderPage)

    // Both files visible in the active uploader UI
    await expect(uploaderPage.getByText(file1.name)).toBeVisible()
    await expect(uploaderPage.getByText(file2.name)).toBeVisible()

    await navigateToDownloadPage(downloaderPage, shareUrl, [file1, file2])
    await runMultiFileTransfer(downloaderPage, [file1, file2])
    await saveMultiFileZip(downloaderPage)
    await verifyMultiFileCompletion(downloaderPage, 2)
  } finally {
    await cleanup()
  }
})

test('multi-file transfer: integrity verified banner appears', async ({ browser }) => {
  const file1 = createTestFile('verified-a.txt', 'A'.repeat(1024))
  const file2 = createTestFile('verified-b.txt', 'B'.repeat(1024))

  const { uploaderPage, downloaderPage, cleanup } = await createBrowserContexts(browser)

  try {
    await uploadFile(uploaderPage, file1)
    await addFile(uploaderPage, file2)

    const shareUrl = await startUpload(uploaderPage)

    await navigateToDownloadPage(downloaderPage, shareUrl, [file1, file2])
    await runMultiFileTransfer(downloaderPage, [file1, file2])

    // Integrity verified banner should appear on "Files ready to save." screen
    await expect(downloaderPage.getByText(/integrity verified/i)).toBeVisible({ timeout: 10000 })

    await saveMultiFileZip(downloaderPage)
    await verifyMultiFileCompletion(downloaderPage, 2)
  } finally {
    await cleanup()
  }
})
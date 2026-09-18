import { test, expect, devices } from '@playwright/test'
import {
  createTestFile,
  uploadFile,
  addFile,
  startUpload,
  createBrowserContexts,
  saveZipAndCapture,
  TestFile,
} from './helpers'

/**
 * Regression coverage for issue #8 — multi-file internet-share zips were
 * downloaded as an empty/malformed archive on mobile browsers.
 *
 * These tests capture the actual bytes the browser receives and parse them,
 * which the original UI-only tests never did.
 *
 * The zip save path differs per platform:
 *   - desktop: `showSaveFilePicker` is unavailable (mocked) -> StreamSaver
 *   - android: mobile UA -> StreamSaver skipped -> Response + object URL
 * The object-URL path is where the bug lived.
 */

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'zip save fallbacks are exercised on Chromium',
)

async function transferMultiFile(
  page: import('@playwright/test').Page,
  shareUrl: string,
  files: TestFile[],
): Promise<void> {
  await page.goto(shareUrl)
  for (const file of files) {
    await expect(page.getByText(file.name)).toBeVisible({ timeout: 10000 })
  }
  await page.locator('#download-button').click()
  await expect(
    page.getByText(new RegExp(`downloading ${files.length} file`, 'i')),
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/files? ready to save/i)).toBeVisible({
    timeout: 30000,
  })
}

function expectZipMatchesFiles(
  zip: { entries: Record<string, Uint8Array> },
  files: TestFile[],
): void {
  expect(Object.keys(zip.entries).sort()).toEqual(
    files.map((f) => f.name).sort(),
  )
  const decoder = new TextDecoder()
  for (const file of files) {
    expect(decoder.decode(zip.entries[file.name])).toBe(file.content)
  }
}

test('desktop: multi-file zip downloads a valid archive', async ({
  browser,
}) => {
  const files = [
    createTestFile('alpha.txt', 'A'.repeat(1024)),
    createTestFile('beta.txt', 'B'.repeat(2048)),
  ]

  const { uploaderPage, downloaderPage, cleanup } =
    await createBrowserContexts(browser)

  try {
    await uploadFile(uploaderPage, files[0])
    await addFile(uploaderPage, files[1])
    const shareUrl = await startUpload(uploaderPage)

    await transferMultiFile(downloaderPage, shareUrl, files)

    const zip = await saveZipAndCapture(downloaderPage)
    expectZipMatchesFiles(zip, files)
  } finally {
    await cleanup()
  }
})

test('android: multi-file zip downloads a valid archive', async ({
  browser,
}) => {
  const files = [
    createTestFile('alpha.txt', 'A'.repeat(1024)),
    createTestFile('beta.txt', 'B'.repeat(2048)),
    createTestFile('gamma.bin', 'C'.repeat(4096)),
  ]

  // Sender stays on desktop; receiver emulates Brave/Chrome on Android, which
  // is the environment from issue #8.
  const { uploaderPage, downloaderPage, cleanup } = await createBrowserContexts(
    browser,
    { downloader: { ...devices['Pixel 7'] } },
  )

  try {
    await uploadFile(uploaderPage, files[0])
    await addFile(uploaderPage, files[1])
    await addFile(uploaderPage, files[2])
    const shareUrl = await startUpload(uploaderPage)

    await transferMultiFile(downloaderPage, shareUrl, files)

    const zip = await saveZipAndCapture(downloaderPage)
    expectZipMatchesFiles(zip, files)
  } finally {
    await cleanup()
  }
})

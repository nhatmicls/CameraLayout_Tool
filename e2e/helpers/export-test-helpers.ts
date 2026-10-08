import type { Download, Page } from '@playwright/test'

/** Collects console/page errors from `page` for the duration of the test; call the returned function at the end and assert it is empty. */
export async function collectErrors(page: Page): Promise<() => string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`[page] ${err.message}`))
  return () => errors
}

/** Reads a Playwright `Download`'s full content as a UTF-8 string (CSV/JSON exports). */
export async function readDownloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

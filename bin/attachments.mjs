import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export async function downloadAttachments(attachments = [], baseUrl = 'https://www.maybole.ai', fetchImpl = fetch) {
  if (!attachments.length) return { paths: [], cleanup: async () => {} }
  const expected = new URL(baseUrl).origin
  const directory = await mkdtemp(join(tmpdir(), 'maybole-attachments-'))
  const paths = []
  try {
    for (const attachment of attachments) {
      const source = attachment.download_url || attachment.url
      if (!source) throw new Error('attachment_failed')
      const url = new URL(source)
      if (url.protocol !== 'https:' || url.origin !== expected) throw new Error('attachment_failed')
      const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error('attachment_failed')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('attachment_failed')
      const filename = basename(String(attachment.filename || 'attachment')).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment'
      const path = join(directory, `${paths.length}-${filename}`)
      await writeFile(path, bytes, { mode: 0o600, flag: 'wx' })
      paths.push(path)
    }
    return { paths, cleanup: () => rm(directory, { recursive: true, force: true }) }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}

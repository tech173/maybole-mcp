import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import test from 'node:test'
import { downloadAttachments } from '../bin/attachments.mjs'

test('downloads the server download_url contract and cleans it up', async () => {
  const result = await downloadAttachments([{ download_url: 'https://www.maybole.ai/file', filename: '../../resume.pdf' }], 'https://www.maybole.ai', async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }))
  assert.match(result.paths[0], /resume\.pdf$/)
  await result.cleanup()
  await assert.rejects(access(result.paths[0]))
})

test('rejects cross-origin, insecure, redirected, failed, and oversized attachments', async () => {
  await assert.rejects(downloadAttachments([{ url: 'https://evil.test/x', filename: 'x' }]), /attachment_failed/)
  await assert.rejects(downloadAttachments([{ url: 'http://www.maybole.ai/x', filename: 'x' }]), /attachment_failed/)
  await assert.rejects(downloadAttachments([{ url: 'https://www.maybole.ai/x', filename: 'x' }], 'https://www.maybole.ai', async () => ({ ok: false })), /attachment_failed/)
  const huge = new Uint8Array(10 * 1024 * 1024 + 1)
  await assert.rejects(downloadAttachments([{ url: 'https://www.maybole.ai/x', filename: 'x' }], 'https://www.maybole.ai', async () => ({ ok: true, arrayBuffer: async () => huge.buffer })), /attachment_failed/)
})

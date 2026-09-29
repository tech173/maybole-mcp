import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, resolve, sep } from 'node:path'

const crlf = (value) => String(value ?? '').replace(/\r?\n/g, '\r\n')
const header = (value) => crlf(value).replace(/[\r\n]+/g, ' ').trim()
const safeName = (value) => header(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'draft'

export function renderEml(draft) {
  const boundary = `maybole-${String(draft.delivery_key || 'draft').replace(/[^a-zA-Z0-9]/g, '')}`
  const lines = [
    `To: ${header(draft.to)}`,
    `Subject: ${header(draft.subject || '(no subject)')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    'X-Unsent: 1',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    crlf(draft.body || ''),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    crlf(draft.body_html || `<pre>${String(draft.body || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`),
    `--${boundary}--`,
    '',
  ]
  return lines.join('\r\n')
}

export function exportEml(draft, directory) {
  const root = resolve(directory)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const filename = `${safeName(draft.subject)}-${String(draft.delivery_key || 'draft').slice(0, 8)}.eml`
  const path = resolve(root, basename(filename))
  if (!path.startsWith(`${root}${sep}`)) throw new Error('invalid_export_path')
  writeFileSync(path, renderEml(draft), { mode: 0o600, flag: 'wx' })
  return path
}

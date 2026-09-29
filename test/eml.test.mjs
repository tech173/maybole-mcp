import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { exportEml, renderEml } from '../bin/eml.mjs'

test('renders an unsent UTF-8 draft and blocks header injection', () => {
  const text = renderEml({ delivery_key: 'abc-123', to: 'person@example.com\r\nBcc: attacker@example.com', subject: 'Hello\nBcc: nope', body: 'Hi 世界', body_html: '<p>Hi 世界</p>' })
  assert.match(text, /X-Unsent: 1/)
  assert.match(text, /Hi 世界/)
  assert.doesNotMatch(text, /\r\nBcc:/)
})

test('exports only inside the selected directory with a sanitized filename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'maybole-eml-'))
  const path = exportEml({ delivery_key: '12345678-rest', to: 'p@example.com', subject: '../../hello', body: 'Body' }, dir)
  assert.equal(path.startsWith(`${dir}/`), true)
  assert.doesNotMatch(path, /\.\.\//)
  assert.match(readFileSync(path, 'utf8'), /X-Unsent: 1/)
})

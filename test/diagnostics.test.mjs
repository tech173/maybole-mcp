import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnosticEvent } from '../bin/diagnostics.mjs'

test('diagnostics whitelist operational fields and discard message content and credentials', () => {
  const event = diagnosticEvent('batch_complete', { adapter: 'apple_mail', count: 4, duration_ms: 12.7, error_code: 'provider_error', to: 'secret@example.com', subject: 'Secret', body: 'Secret body', api_key: 'mby_secret' })
  assert.deepEqual(Object.keys(event).sort(), ['adapter', 'at', 'count', 'duration_ms', 'error_code', 'event'])
  assert.doesNotMatch(JSON.stringify(event), /secret/i)
})

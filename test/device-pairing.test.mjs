import assert from 'node:assert/strict'
import test from 'node:test'
import { pairDevice } from '../bin/device-pairing.mjs'
import { writeCredential } from '../bin/credential-store.mjs'

test('rejects malformed credentials before touching an OS store', () => {
  assert.throws(() => writeCredential('not-a-key', 'darwin'), /malformed/)
})

test('pairs, polls pending, stores one key, and logs no credential', async () => {
  const key = `mby_${'a'.repeat(40)}`
  const replies = [
    { ok: true, body: { device_code: 'secret-device', user_code: 'ABCD-2345', verification_uri: 'https://example.test/mcp/device', expires_in: 60, interval: 3 } },
    { ok: false, body: { error: 'authorization_pending' } },
    { ok: true, body: { access_token: key } },
  ]
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    const reply = replies.shift()
    return { ok: reply.ok, json: async () => reply.body }
  }
  let output = ''
  let stored = ''
  const result = await pairDevice('https://example.test', fetchImpl, { write: (value) => { output += value } }, async () => {}, (value) => { stored = value })
  assert.equal(result, key)
  assert.equal(stored, key)
  assert.equal(calls.length, 3)
  assert.match(output, /ABCD-2345/)
  assert.doesNotMatch(output, /mby_/)
})

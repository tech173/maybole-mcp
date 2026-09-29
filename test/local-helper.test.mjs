import assert from 'node:assert/strict'
import { request } from 'node:http'
import test from 'node:test'
import { startLocalHelper } from '../prototypes/local-helper/server.mjs'

test('local helper binds loopback, requires its session token, and ships a locked-down page', async () => {
  const { server, url, token } = await startLocalHelper({ open: false })
  try {
    assert.match(url, /^http:\/\/127\.0\.0\.1:/)
    const page = await fetch(url)
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/)
    assert.doesNotMatch(await page.text(), /__SESSION_TOKEN__/)
    const denied = await fetch(`${url}api/accounts`)
    assert.equal(denied.status, 401)
    const allowed = await fetch(`${url}api/accounts`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(allowed.status, 200)
    assert.equal(Array.isArray((await allowed.json()).accounts), true)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('local helper rejects non-loopback Host headers', async () => {
  const { server, url } = await startLocalHelper({ open: false })
  try {
    const target = new URL(url)
    const status = await new Promise((resolve, reject) => {
      const req = request({ host: target.hostname, port: target.port, path: '/', headers: { Host: 'evil.example' } }, (response) => { response.resume(); resolve(response.statusCode) })
      req.once('error', reject).end()
    })
    assert.equal(status, 403)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('local helper loads drafts and reports created, failed, and cancelled items', async () => {
  const calls = []
  const remoteClient = {
    async callTool(call) {
      calls.push(call)
      if (call.name === 'get_my_drafts') return { content: [{ type: 'text', text: JSON.stringify({ drafts: [{ id: 'd1', subject: 'One' }] }) }] }
      if (call.name === 'start_mailbox_delivery') return { content: [{ type: 'text', text: JSON.stringify({ session_id: 's1', drafts: [
        { id: 'd1', delivery_key: 'k1', to: 'one@example.com', subject: 'One', body: 'Body one' },
        { id: 'd2', delivery_key: 'k2', to: 'two@example.com', subject: 'Two', body: 'Body two' },
        { id: 'd3', delivery_key: 'k3', to: 'three@example.com', subject: 'Three', body: 'Body three' },
      ] }) }] }
      return { content: [{ type: 'text', text: JSON.stringify({ accepted: true }) }] }
    },
  }
  const draftCreator = ({ draft }) => {
    if (draft.id === 'd2') throw new Error('provider_error')
    return { external_draft_id: `native-${draft.id}` }
  }
  const options = {
    open: false,
    remoteClient,
    accountLister: () => [{ adapter: 'apple_mail', address: 'me@example.com', supported: true }],
    draftCreator,
    attachmentDownloader: async () => ({ paths: [], cleanup: async () => {} }),
    testRequirer: () => {},
  }
  const { server, url, token } = await startLocalHelper(options)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const drafts = await fetch(`${url}api/drafts`, { headers })
    assert.equal(drafts.status, 200)
    assert.deepEqual((await drafts.json()).drafts, [{ id: 'd1', subject: 'One' }])

    const created = await fetch(`${url}api/create-batch`, { method: 'POST', headers, body: JSON.stringify({ adapter: 'apple_mail', account: 'me@example.com', confirmed: true, draft_ids: ['d1', 'd2'] }) })
    assert.equal(created.status, 200)
    const result = await created.json()
    assert.deepEqual(result.results.map(({ draft_id, result: status }) => [draft_id, status]), [['d1', 'created'], ['d2', 'failed'], ['d3', 'cancelled']])
    const completion = calls.find((call) => call.name === 'complete_mailbox_delivery')
    assert.deepEqual(completion.arguments.results, [
      { delivery_key: 'k1', result: 'created', external_draft_id: 'native-d1' },
      { delivery_key: 'k2', result: 'failed', error_code: 'provider_error' },
      { delivery_key: 'k3', result: 'cancelled', error_code: 'user_cancelled' },
    ])
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('local helper requires explicit confirmation and a tested exact account', async () => {
  const remoteClient = { callTool: async () => { throw new Error('must not be called') } }
  const { server, url, token } = await startLocalHelper({ open: false, remoteClient, testRequirer: () => { throw new Error('test_draft_required') } })
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const unconfirmed = await fetch(`${url}api/create-batch`, { method: 'POST', headers, body: JSON.stringify({ draft_ids: [] }) })
    assert.equal(unconfirmed.status, 400)
    assert.equal((await unconfirmed.json()).error, 'invalid_request')
    const untested = await fetch(`${url}api/create-batch`, { method: 'POST', headers, body: JSON.stringify({ adapter: 'apple_mail', account: 'wrong@example.com', confirmed: true, draft_ids: ['d1'] }) })
    assert.equal(untested.status, 400)
    assert.equal((await untested.json()).error, 'test_draft_required')
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('local helper pairs in the UI without exposing the access token', async () => {
  const key = `mby_${'b'.repeat(40)}`
  const remoteClient = { callTool: async () => ({ content: [{ type: 'text', text: '{"drafts":[]}' }] }) }
  const { server, url, token } = await startLocalHelper({
    open: false,
    key: null,
    pairingStarter: async () => ({ device_code: 'private-code', user_code: 'USER-1234', verification_uri: 'https://example.test/connect', expires_in: 600, interval: 3 }),
    pairingPoller: async (code) => { assert.equal(code, 'private-code'); return { status: 'connected', access_token: key } },
    remoteConnector: async (credential) => { assert.equal(credential, key); return remoteClient },
  })
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    assert.deepEqual(await (await fetch(`${url}api/status`, { headers })).json(), { paired: false })
    const started = await (await fetch(`${url}api/pair/start`, { method: 'POST', headers, body: '{}' })).json()
    assert.equal(started.user_code, 'USER-1234')
    const polled = await (await fetch(`${url}api/pair/poll`, { method: 'POST', headers, body: JSON.stringify({ device_code: started.device_code }) })).json()
    assert.deepEqual(polled, { status: 'connected' })
    assert.equal(JSON.stringify(polled).includes('mby_'), false)
    assert.deepEqual(await (await fetch(`${url}api/status`, { headers })).json(), { paired: true })
    assert.equal((await fetch(`${url}api/reconnect`, { method: 'POST', headers })).status, 200)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('local helper discards a stale stored credential and still opens pairing', async () => {
  let deleted = 0
  const { server, url, token } = await startLocalHelper({
    open: false,
    key: `mby_${'a'.repeat(40)}`,
    remoteConnector: async () => { throw Object.assign(new Error('revoked'), { code: 401 }) },
    credentialDeleter: () => { deleted++ },
  })
  try {
    assert.equal(deleted, 1)
    assert.deepEqual(await (await fetch(`${url}api/status`, { headers: { Authorization: `Bearer ${token}` } })).json(), { paired: false, connection_error: 'pairing_required' })
    assert.equal((await fetch(url)).status, 200)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})


test('offline startup preserves stored credentials and permits reconnect', async () => {
  let deleted = false
  let online = false
  const remoteClient = {}
  const { server, url, token } = await startLocalHelper({ open: false, key: `mby_${'a'.repeat(40)}`,
    remoteConnector: async () => { if (!online) throw new Error('network down'); return remoteClient },
    credentialDeleter: () => { deleted = true },
  })
  try {
    const headers = { Authorization: `Bearer ${token}` }
    assert.equal(deleted, false)
    assert.equal((await (await fetch(`${url}api/status`, { headers })).json()).connection_error, 'offline')
    online = true
    assert.equal((await fetch(`${url}api/reconnect`, { method: 'POST', headers })).status, 200)
    assert.equal((await (await fetch(`${url}api/status`, { headers })).json()).paired, true)
  } finally { await new Promise(resolve => server.close(resolve)) }
})

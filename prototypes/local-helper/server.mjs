import { ownHelperLifetime } from '../../bin/helper-lifecycle.mjs'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { listMailAccounts, accountDiagnostic, accountErrorCode } from '../../bin/mail-accounts.mjs'
import { createNativeDraft } from '../../bin/draft-adapters.mjs'
import { recordTestedAccount } from '../../bin/preferences.mjs'
import { requireTestedAccount } from '../../bin/preferences.mjs'
import { deleteCredential, readCredential } from '../../bin/credential-store.mjs'
import { downloadAttachments } from '../../bin/attachments.mjs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { pollDevicePairing, startDevicePairing } from '../../bin/device-pairing.mjs'

const nativeStatus = (value) => { if (process.env.MAYBOLE_NATIVE_APP === '1') process.stdout.write(`${JSON.stringify(value)}\n`) }
const htmlPath = fileURLToPath(new URL('./ui.html', import.meta.url))
function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}

async function bodyOf(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32_768) throw new Error('request_too_large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const jsonOf = (result) => JSON.parse(result.content?.find((part) => part.type === 'text')?.text || '{}')
const providerOf = (adapter) => adapter === 'apple_mail' ? 'apple_mail' : adapter.startsWith('outlook') ? 'outlook' : 'other'

async function connectRemote(key, remoteUrl) {
  if (!key) return null
  const client = new Client({ name: 'maybole-mailbox-local-ui', version: '0.1.1' })
  try { await client.connect(new StreamableHTTPClientTransport(new URL(remoteUrl), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }), { timeout: 8_000 }) }
  catch (error) { await client.close().catch(() => {}); throw error }
  return client
}

export async function startLocalHelper({
  port = 0,
  open = true,
  key = readCredential(),
  remoteUrl = process.env.MAYBOLE_MCP_URL || `${(process.env.MAYBOLE_BASE_URL || 'https://www.maybole.ai').replace(/\/$/, '')}/api/mcp`,
  remoteClient,
  accountLister = listMailAccounts,
  draftCreator = createNativeDraft,
  attachmentDownloader = downloadAttachments,
  testRecorder = recordTestedAccount,
  testRequirer = requireTestedAccount,
  pairingStarter = startDevicePairing,
  pairingPoller = pollDevicePairing,
  remoteConnector = connectRemote,
  credentialDeleter = deleteCredential,
} = {}) {
  const token = randomBytes(32).toString('base64url')
  const page = await readFile(htmlPath, 'utf8')
  let remote = remoteClient || null
  let connectionError = null
  const reconnect = async () => {
    try { remote = await remoteConnector(key, remoteUrl); connectionError = null }
    catch (error) {
      remote = null
      if ([401, 403].includes(error.code ?? error.status)) { credentialDeleter(); key = null; connectionError = 'pairing_required' }
      else connectionError = 'offline'
    }
  }
  if (!remote && key) {
    await reconnect()
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.headers.host && !/^127\.0\.0\.1(?::\d+)?$/.test(request.headers.host)) return json(response, 403, { error: 'loopback_only' })
    if (url.pathname === '/' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" })
      return response.end(page.replaceAll('__SESSION_TOKEN__', token))
    }
    if (request.headers.authorization !== `Bearer ${token}`) return json(response, 401, { error: 'unauthorized' })
    if (url.pathname === '/api/status' && request.method === 'GET') return json(response, 200, { paired: Boolean(remote), ...(connectionError ? { connection_error: connectionError } : {}) })
    if (url.pathname === '/api/reconnect' && request.method === 'POST') {
      if (key) await reconnect()
      nativeStatus({ paired: Boolean(remote) })
      return json(response, remote ? 200 : 503, { paired: Boolean(remote), connection_error: connectionError })
    }
    if (url.pathname === '/api/pair/start' && request.method === 'POST') {
      try {
        const flow = await pairingStarter(new URL(remoteUrl).origin)
        return json(response, 200, { device_code: flow.device_code, user_code: flow.user_code, verification_uri: flow.verification_uri, expires_in: flow.expires_in, interval: flow.interval })
      } catch (error) { return json(response, 502, { error: error.message || 'pairing_failed' }) }
    }
    if (url.pathname === '/api/pair/poll' && request.method === 'POST') {
      try {
        const input = await bodyOf(request)
        const result = await pairingPoller(input.device_code, new URL(remoteUrl).origin)
        if (result.status === 'connected') { key = result.access_token; remote = await remoteConnector(key, remoteUrl); connectionError = null; nativeStatus({ paired: Boolean(remote) }) }
        return json(response, 200, { status: result.status, retry_after: result.retry_after })
      } catch (error) { return json(response, 400, { error: error.message || 'pairing_failed' }) }
    }
    if (url.pathname === '/api/accounts' && request.method === 'GET') {
      try {
        const accounts = accountLister()
        return json(response, 200, { accounts: accounts.filter(a => a.supported), diagnostics: accounts.filter(a => !a.supported) })
      } catch (error) { return json(response, 200, { accounts: [], diagnostics: [accountDiagnostic('desktop_mail', accountErrorCode(error))] }) }
    }
    if (url.pathname === '/api/drafts' && request.method === 'GET') {
      if (!remote) return json(response, 401, { error: 'pairing_required' })
      try { return json(response, 200, jsonOf(await remote.callTool({ name: 'get_my_drafts', arguments: { limit: 25 } }))) }
      catch { return json(response, 502, { error: 'maybole_unavailable' }) }
    }
    if (url.pathname === '/api/test-draft' && request.method === 'POST') {
      try {
        const input = await bodyOf(request)
        const accounts = accountLister()
        const result = draftCreator({ adapter: input.adapter, account: input.account, draft: { to: input.account, subject: 'Maybole test draft — safe to delete', body: 'This unsent draft confirms Maybole is connected to the correct mailbox. It was not sent.' } }, accounts)
        testRecorder(input.adapter, input.account)
        nativeStatus({ account: input.account })
        return json(response, 200, { created: true, ...result })
      } catch (error) { return json(response, 400, { error: error.message || 'provider_error' }) }
    }
    if (url.pathname === '/api/create-batch' && request.method === 'POST') {
      if (!remote) return json(response, 401, { error: 'pairing_required' })
      let input
      try {
        input = await bodyOf(request)
        if (input.confirmed !== true || !Array.isArray(input.draft_ids) || input.draft_ids.length > 25) throw new Error('invalid_request')
        testRequirer(input.adapter, input.account)
        const session = jsonOf(await remote.callTool({ name: 'start_mailbox_delivery', arguments: { provider: providerOf(input.adapter), target_account: input.account, limit: 25 } }))
        const selected = new Set(input.draft_ids)
        const accounts = accountLister()
        const results = []
        for (const draft of session.drafts || []) {
          if (!selected.has(draft.id)) { results.push({ delivery_key: draft.delivery_key, draft_id: draft.id, result: 'cancelled', error_code: 'user_cancelled' }); continue }
          let files
          try {
            files = await attachmentDownloader(draft.attachments, new URL(remoteUrl).origin)
            const created = draftCreator({ adapter: input.adapter, account: input.account, draft, attachments: files.paths }, accounts)
            results.push({ delivery_key: draft.delivery_key, draft_id: draft.id, result: 'created', external_draft_id: created.external_draft_id, ...(created.fidelity_warning ? { fidelity_warning: created.fidelity_warning } : {}) })
          } catch (error) { results.push({ delivery_key: draft.delivery_key, draft_id: draft.id, result: 'failed', error_code: error.message === 'attachment_failed' ? 'attachment_failed' : 'provider_error' }) }
          finally { await files?.cleanup() }
        }
        const completionResults = results.map((item) => ({
          delivery_key: item.delivery_key,
          result: item.result,
          ...(item.external_draft_id ? { external_draft_id: item.external_draft_id } : {}),
          ...(item.error_code ? { error_code: item.error_code } : {}),
        }))
        const completion = jsonOf(await remote.callTool({ name: 'complete_mailbox_delivery', arguments: { session_id: session.session_id, results: completionResults } }))
        return json(response, 200, { results, completion })
      } catch (error) { return json(response, 400, { error: error.message || 'provider_error' }) }
    }
    return json(response, 404, { error: 'not_found' })
  })
  await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).once('error', reject))
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/`
  if (open) {
    const { spawn } = await import('node:child_process')
    const command = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd.exe', ['/c', 'start', '', url]] : ['xdg-open', [url]]
    spawn(command[0], command[1], { stdio: 'ignore', detached: true }).unref()
  }
  nativeStatus({ url, paired: Boolean(remote) })
  return { server, url, token }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let running
  ownHelperLifetime(() => running?.server, { parentInput: process.env.MAYBOLE_NATIVE_APP === '1' ? process.stdin : null })
  running = await startLocalHelper({ open: process.env.MAYBOLE_NATIVE_APP !== '1' })
  process.stderr.write(`Maybole Mailbox is open at ${running.url}\n`)
}

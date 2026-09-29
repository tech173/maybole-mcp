import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createNativeDraft, verifyNativeDraft } from './draft-adapters.mjs'
import { downloadAttachments } from './attachments.mjs'
import { exportEml } from './eml.mjs'
import { listMailAccounts } from './mail-accounts.mjs'
import { recordTestedAccount, requireTestedAccount } from './preferences.mjs'
import { logDiagnostic } from './diagnostics.mjs'
import { deleteCredential } from './credential-store.mjs'

const localTools = [
  { name: 'list_mail_accounts', description: 'List local mail accounts and supported draft-only adapters. Returns no mailbox contents.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'create_test_draft', description: 'Create one clearly labelled unsent test draft in an exact local account. Never sends.', inputSchema: { type: 'object', required: ['adapter', 'account'], properties: { adapter: { type: 'string' }, account: { type: 'string' } }, additionalProperties: false } },
  { name: 'create_mailbox_drafts', description: 'After explicit confirmation and a successful test draft, create a bounded Maybole batch as drafts only. Never sends.', inputSchema: { type: 'object', required: ['adapter', 'account', 'confirmed'], properties: { adapter: { type: 'string' }, account: { type: 'string' }, confirmed: { const: true }, limit: { type: 'integer', minimum: 1, maximum: 25 } }, additionalProperties: false } },
  { name: 'verify_draft', description: 'Verify that a previously returned local draft identifier still exists. Reads no message content.', inputSchema: { type: 'object', required: ['adapter', 'account', 'external_draft_id'], properties: { adapter: { type: 'string' }, account: { type: 'string' }, external_draft_id: { type: 'string', maxLength: 512 } }, additionalProperties: false } },
  { name: 'export_eml', description: 'Export one inert unsent .eml draft inside a chosen local directory.', inputSchema: { type: 'object', required: ['directory', 'draft'], properties: { directory: { type: 'string' }, draft: { type: 'object' } }, additionalProperties: false } },
  { name: 'revoke_pairing', description: 'Revoke this bridge credential at Maybole and remove it from the operating-system credential store.', inputSchema: { type: 'object', properties: { confirmed: { const: true } }, required: ['confirmed'], additionalProperties: false } },
]

const text = (value, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], isError })
const jsonOf = (result) => JSON.parse(result.content?.find((part) => part.type === 'text')?.text || '{}')
const providerOf = (adapter) => adapter === 'apple_mail' ? 'apple_mail' : adapter.startsWith('outlook') ? 'outlook' : 'other'

export async function startServer({ key, url = 'https://www.maybole.ai/api/mcp', transport = new StdioServerTransport() }) {
  const remote = new Client({ name: 'maybole-mailbox-bridge', version: '0.1.1' })
  await remote.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }))
  const hosted = await remote.listTools()
  const server = new Server({ name: 'maybole-mailbox-bridge', version: '0.1.1' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...hosted.tools.filter((tool) => !localTools.some((local) => local.name === tool.name)), ...localTools] }))
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const args = request.params.arguments || {}
    try {
      if (request.params.name === 'list_mail_accounts') return text({ accounts: listMailAccounts() })
      if (request.params.name === 'create_test_draft') {
        const result = createNativeDraft({ adapter: args.adapter, account: args.account, draft: { to: args.account, subject: 'Maybole test draft — safe to delete', body: 'This unsent draft confirms Maybole is connected to the correct mailbox. It was not sent.' } }, listMailAccounts())
        recordTestedAccount(args.adapter, args.account)
        return text({ created: true, account: args.account, ...result })
      }
      if (request.params.name === 'export_eml') return text({ path: exportEml(args.draft, args.directory), created: true })
      if (request.params.name === 'verify_draft') return text({ exists: verifyNativeDraft(args, listMailAccounts()) })
      if (request.params.name === 'revoke_pairing') {
        if (args.confirmed !== true) return text({ error: 'confirmation_required' }, true)
        const base = new URL(url).origin
        const response = await fetch(`${base}/api/mcp/device/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } })
        if (!response.ok) return text({ error: 'revoke_failed' }, true)
        deleteCredential()
        return text({ revoked: true, restart_required: true })
      }
      if (request.params.name === 'create_mailbox_drafts') {
        const startedAt = Date.now()
        if (args.confirmed !== true) return text({ error: 'confirmation_required' }, true)
        requireTestedAccount(args.adapter, args.account)
        const session = jsonOf(await remote.callTool({ name: 'start_mailbox_delivery', arguments: { provider: providerOf(args.adapter), target_account: args.account, limit: args.limit || 25 } }))
        const accounts = listMailAccounts()
        const results = []
        const drafts = session.drafts || []
        for (let index = 0; index < drafts.length; index++) {
          const draft = drafts[index]
          if (extra.signal?.aborted) {
            for (const remaining of drafts.slice(index)) results.push({ delivery_key: remaining.delivery_key, result: 'cancelled', error_code: 'user_cancelled' })
            break
          }
          let downloaded
          try {
            downloaded = await downloadAttachments(draft.attachments, new URL(url).origin)
            const created = createNativeDraft({ adapter: args.adapter, account: args.account, draft, attachments: downloaded.paths }, accounts)
            results.push({ delivery_key: draft.delivery_key, result: 'created', external_draft_id: created.external_draft_id })
          } catch (error) { results.push({ delivery_key: draft.delivery_key, result: 'failed', error_code: error.message === 'attachment_failed' ? 'attachment_failed' : 'provider_error' }) }
          finally { await downloaded?.cleanup() }
        }
        const completion = jsonOf(await remote.callTool({ name: 'complete_mailbox_delivery', arguments: { session_id: session.session_id, results } }))
        logDiagnostic('batch_complete', { adapter: args.adapter, count: results.filter((result) => result.result === 'created').length, duration_ms: Date.now() - startedAt })
        return text({ account: args.account, results, completion })
      }
      return await remote.callTool({ name: request.params.name, arguments: args })
    } catch (error) { return text({ error: error.message || 'provider_error' }, true) }
  })
  await server.connect(transport)
  return { server, remote }
}

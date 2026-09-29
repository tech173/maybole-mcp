#!/usr/bin/env node
/** Local MCP bridge. Uses the bundled MCP SDK, device pairing, and the OS
 * credential store. Hosted-only clients can use https://www.maybole.ai/mcp.
 * Run from an installed checkout with `node bin/cli.mjs`; no secrets in arguments.
 */
import { readCredential } from './credential-store.mjs'
import { pairDevice } from './device-pairing.mjs'
import { startServer } from './server.mjs'

let key = (process.env.MAYBOLE_API_KEY || readCredential() || '').trim()
if (!/^mby_[0-9a-f]{40}$/.test(key)) {
  try { key = await pairDevice(process.env.MAYBOLE_BASE_URL || 'https://www.maybole.ai') }
  catch (error) { process.stderr.write(`maybole-mcp: ${error.message}\n`); process.exit(1) }
}

const url = process.env.MAYBOLE_MCP_URL || 'https://www.maybole.ai/api/mcp'
await startServer({ key, url })

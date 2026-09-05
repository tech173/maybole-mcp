#!/usr/bin/env node
/**
 * maybole-mcp — stdio bridge to the hosted Maybole MCP server.
 *
 * Most AI clients (Claude Desktop, Claude web, ChatGPT, Cursor, VS Code) connect
 * to a remote MCP URL directly — for those you don't need this package, just
 * point them at https://www.maybole.ai/api/mcp with your key as a Bearer header
 * (see the README).
 *
 * This shim is for stdio-only clients. It runs `mcp-remote` under the hood,
 * which proxies stdio <-> the hosted Streamable HTTP endpoint.
 *
 * Usage:
 *   MAYBOLE_API_KEY=mby_xxx npx maybole-mcp
 *   npx maybole-mcp mby_xxx
 *
 * Get a free key: https://www.maybole.ai/mcp
 */
import { spawn } from 'node:child_process'

const key = (process.env.MAYBOLE_API_KEY || process.argv[2] || '').trim()
if (!/^mby_[0-9a-f]{40}$/.test(key)) {
  process.stderr.write(
    'maybole-mcp: missing or malformed API key.\n' +
      'Set MAYBOLE_API_KEY (mby_ + 40 hex) or pass it as the first argument.\n' +
      'Get a free key at https://www.maybole.ai/mcp\n',
  )
  process.exit(1)
}

const url = process.env.MAYBOLE_MCP_URL || 'https://www.maybole.ai/api/mcp'
const isWin = process.platform === 'win32'

const child = spawn(
  isWin ? 'npx.cmd' : 'npx',
  ['-y', 'mcp-remote@latest', url, '--header', `Authorization: Bearer ${key}`],
  { stdio: 'inherit', shell: isWin },
)

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  process.stderr.write(
    `maybole-mcp: could not start mcp-remote (${err.message}). ` +
      'Is npx on your PATH? You can also connect the hosted URL directly — see the README.\n',
  )
  process.exit(1)
})

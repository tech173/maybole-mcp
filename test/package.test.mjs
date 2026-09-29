import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

test('MCPB manifest and npm package versions stay aligned', () => {
  assert.equal(manifest.manifest_version, '0.3')
  assert.equal(manifest.version, pkg.version)
})

test('bundle launches the same stdio entry point as the npm package', () => {
  assert.equal(manifest.server.type, 'node')
  assert.equal(manifest.server.entry_point, 'bin/cli.mjs')
  assert.equal(pkg.bin['maybole-mcp'], manifest.server.entry_point)
})

test('credentials are obtained by device pairing, never manifest fields or command arguments', () => {
  assert.deepEqual(manifest.user_config, {})
  assert.deepEqual(manifest.server.mcp_config.env, {})
  assert.deepEqual(manifest.server.mcp_config.args, ['${__dirname}/bin/cli.mjs'])
})

test('the extension declares review-first no-send behavior', () => {
  assert.match(manifest.description, /never sends email/i)
  assert.doesNotMatch(JSON.stringify(manifest), /send_email|send_message/i)
})

test('the stdio bridge uses the pinned MCP SDK and never invokes a package runner', async () => {
  assert.match(pkg.dependencies['@modelcontextprotocol/sdk'], /^\^1\./)
  const cli = await readFile(new URL('bin/cli.mjs', root), 'utf8')
  assert.match(cli, /startServer/)
  assert.doesNotMatch(cli, /mcp-remote@latest|npx\.cmd|['"]npx['"]/)
})

test('public links, tool inventories, and installation docs match this package', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8')
  const skill = await readFile(new URL('skills/maybole/SKILL.md', root), 'utf8')
  const bridge = await readFile(new URL('bin/server.mjs', root), 'utf8')
  const registry = await readFile(new URL('server.json', root), 'utf8')
  for (const content of [readme, skill, JSON.stringify(pkg), JSON.stringify(manifest), registry]) {
    assert.doesNotMatch(content, /github\.com\/maybole\/maybole-mcp/)
  }
  assert.match(pkg.repository.url, /tech173\/maybole-mcp/)
  for (const tool of ['guess_email', 'find_contact', 'add_to_skip_list', 'get_my_drafts', 'mark_drafts_in_mailbox', 'start_mailbox_delivery', 'complete_mailbox_delivery']) {
    assert.ok(readme.includes(`\`${tool}\``), tool)
    assert.ok(skill.includes(`\`${tool}\``), tool)
  }
  const local = bridge.slice(bridge.indexOf('const localTools'), bridge.indexOf('const text ='))
  for (const match of local.matchAll(/name: '([^']+)'/g)) {
    assert.ok(readme.includes(`\`${match[1]}\``), match[1])
    assert.ok(skill.includes(`\`${match[1]}\``), match[1])
  }
  assert.match(readme, /no published npm release/)
  assert.ok(pkg.files.includes('skills'))
})

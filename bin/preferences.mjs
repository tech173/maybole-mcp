import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export function preferencesPath(platform = process.platform, env = process.env) {
  const base = platform === 'win32' ? env.LOCALAPPDATA : platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : (env.XDG_CONFIG_HOME || join(homedir(), '.config'))
  return join(base, 'Maybole', 'mailbox-bridge.json')
}

export function readPreferences(path = preferencesPath()) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { version: 1, tested_accounts: {} } }
}

export function recordTestedAccount(adapter, address, path = preferencesPath()) {
  const state = readPreferences(path)
  state.version = 1
  state.tested_accounts ||= {}
  state.tested_accounts[`${adapter}:${address.trim().toLowerCase()}`] = new Date().toISOString()
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  renameSync(temp, path)
}

export function requireTestedAccount(adapter, address, path = preferencesPath()) {
  const state = readPreferences(path)
  if (!state.tested_accounts?.[`${adapter}:${address.trim().toLowerCase()}`]) throw new Error('test_draft_required')
}

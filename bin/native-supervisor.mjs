// This process never loads credentials, network clients, or mail automation.
// It remains responsive while the helper is inside synchronous OS automation.
import { spawn } from 'node:child_process'
const child = spawn(process.execPath, [process.argv[2]], {
  detached: true,
  stdio: ['pipe', 'inherit', 'inherit'],
  env: process.env,
})
let stopping = false
function stop(force = false) {
  if (stopping) return
  stopping = true
  child.stdin.end()
  try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM') } catch {}
  if (!force) setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL') } catch {} }, 1500).unref()
}
process.stdin.on('end', () => stop(true))
process.stdin.on('error', () => stop(true))
process.stdin.resume()
process.once('SIGTERM', () => stop())
process.once('SIGINT', () => stop())
child.once('error', () => process.exit(1))
child.once('exit', (code) => process.exit(stopping ? 0 : code ?? 1))

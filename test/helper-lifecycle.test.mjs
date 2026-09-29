import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
const moduleUrl = new URL('../bin/helper-lifecycle.mjs', import.meta.url).href
async function child() {
  const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'node:http';
    import { ownHelperLifetime } from ${JSON.stringify(moduleUrl)};
    const server=createServer((req,res)=>res.end('ready'));
    ownHelperLifetime(()=>server,{parentInput:process.stdin});
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `], { stdio: ['pipe', 'pipe', 'pipe'] })
  const [data] = await once(process.stdout, 'data')
  return { process, url: `http://127.0.0.1:${String(data).trim()}` }
}
for (const mode of ['normal quit', 'parent force quit']) test(`local helper releases its port after ${mode}`, async () => {
  const running = await child()
  try {
    assert.equal((await fetch(running.url)).status, 200)
    const exited = once(running.process, 'exit')
    if (mode === 'normal quit') running.process.kill('SIGTERM')
    else running.process.stdin.end()
    await exited
    await assert.rejects(fetch(running.url))
  } finally { running.process.kill('SIGKILL') }
})

test('native supervisor kills a blocked helper after parent loss', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'maybole-supervisor-'))
  const script = join(directory, 'blocked.mjs')
  await writeFile(script, `import {createServer} from 'node:http';import {execFileSync} from 'node:child_process';
    const server=createServer((req,res)=>{res.end('blocking');setImmediate(()=>execFileSync('sleep',['30']))});
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));`)
  const supervisor = spawn(process.execPath, [fileURLToPath(new URL('../bin/native-supervisor.mjs', import.meta.url)), script], { stdio: ['pipe', 'pipe', 'pipe'] })
  try {
    const [port] = await once(supervisor.stdout, 'data')
    const url = `http://127.0.0.1:${String(port).trim()}`
    await fetch(url)
    await new Promise(resolve => setTimeout(resolve, 100))
    const exited = once(supervisor, 'exit')
    supervisor.stdin.end()
    await exited
    await assert.rejects(fetch(url))
  } finally { supervisor.kill('SIGKILL'); await rm(directory, { recursive: true, force: true }) }
})

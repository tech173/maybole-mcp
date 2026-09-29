import { writeCredential } from './credential-store.mjs'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function startDevicePairing(baseUrl = 'https://www.maybole.ai', fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/api/mcp/device/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Maybole Mailbox Bridge' }),
  })
  if (!response.ok) throw new Error('Could not start device pairing.')
  return response.json()
}

export async function pollDevicePairing(deviceCode, baseUrl = 'https://www.maybole.ai', fetchImpl = fetch, store = writeCredential) {
  const response = await fetchImpl(`${baseUrl}/api/mcp/device/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  })
  const body = await response.json().catch(() => ({}))
  if (response.ok && body.access_token) {
    store(body.access_token)
    return { status: 'connected', access_token: body.access_token }
  }
  if (['authorization_pending', 'slow_down'].includes(body.error)) return { status: 'pending', retry_after: body.error === 'slow_down' ? 8 : 3 }
  throw new Error(body.error || 'Pairing failed.')
}

export async function pairDevice(baseUrl = 'https://www.maybole.ai', fetchImpl = fetch, output = process.stderr, sleep = delay, store = writeCredential) {
  const flow = await startDevicePairing(baseUrl, fetchImpl)
  output.write(`\nConnect Maybole: open ${flow.verification_uri} and enter ${flow.user_code}\n`)
  const deadline = Date.now() + flow.expires_in * 1000
  while (Date.now() < deadline) {
    await sleep(Math.max(3, flow.interval || 3) * 1000)
    const result = await pollDevicePairing(flow.device_code, baseUrl, fetchImpl, store)
    if (result.status === 'connected') {
      output.write('Maybole connected. The credential is stored by your operating system.\n')
      return result.access_token
    }
  }
  throw new Error('Pairing code expired. Restart the extension to try again.')
}

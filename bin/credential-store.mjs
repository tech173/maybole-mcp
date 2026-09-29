import { execFileSync } from 'node:child_process'

const SERVICE = 'ai.maybole.mailbox-bridge'
const ACCOUNT = 'mcp-api-key'

function run(command, args, input) {
  return execFileSync(command, args, { input, timeout: 10_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }).trim()
}

export function readCredential(platform = process.platform) {
  try {
    if (platform === 'darwin') return run('security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w']) || null
    if (platform === 'linux') return run('secret-tool', ['lookup', 'service', SERVICE, 'account', ACCOUNT]) || null
    if (platform === 'win32') {
      const script = `$t='MayboleMailboxBridge';$p=Join-Path $env:LOCALAPPDATA 'Maybole\\MailboxBridge.key';if(Test-Path $p){$s=Get-Content $p|ConvertTo-SecureString;$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}}`
      return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]) || null
    }
  } catch {}
  return null
}

export function writeCredential(value, platform = process.platform) {
  if (!/^mby_[0-9a-f]{40}$/.test(value)) throw new Error('Refusing to store a malformed Maybole credential.')
  if (platform === 'darwin') {
    run('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', ACCOUNT, '-w', value])
    return
  }
  if (platform === 'linux') {
    run('secret-tool', ['store', '--label=Maybole Mailbox Bridge', 'service', SERVICE, 'account', ACCOUNT], value)
    return
  }
  if (platform === 'win32') {
    const encoded = Buffer.from(value, 'utf8').toString('base64')
    const script = `$d=Join-Path $env:LOCALAPPDATA 'Maybole';New-Item -ItemType Directory -Force $d|Out-Null;$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));$v|ConvertTo-SecureString -AsPlainText -Force|ConvertFrom-SecureString|Set-Content (Join-Path $d 'MailboxBridge.key')`
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    return
  }
  throw new Error('No supported operating-system credential store is available.')
}

export function deleteCredential(platform = process.platform) {
  try {
    if (platform === 'darwin') run('security', ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT])
    else if (platform === 'linux') run('secret-tool', ['clear', 'service', SERVICE, 'account', ACCOUNT])
    else if (platform === 'win32') run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $env:LOCALAPPDATA 'Maybole\\MailboxBridge.key')`])
  } catch {}
}

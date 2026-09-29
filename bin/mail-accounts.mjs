import { execFileSync } from 'node:child_process'

function execute(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', timeout: 15_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
const email = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
function rows(text, adapter) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [id, address, label] = line.split('\t')
    const normalized = (address || '').trim().toLowerCase()
    return { adapter, id, address: normalized, label: label || address || id, supported: email.test(normalized) }
  })
}
export function accountErrorCode(error) {
  const text = `${error?.stderr || ''} ${error?.message || ''}`
  if (/-1743|not authori[sz]ed|not permitted|permission denied/i.test(text)) return 'permission_denied'
  if (error?.code === 'ETIMEDOUT' || /-1712|timed? out|timeout/i.test(text)) return 'timeout'
  if (/-10814|-600|application.*(?:not found|can.t be found)|ENOENT/i.test(text)) return 'app_unavailable'
  if (/-1708|-1728|doesn.t understand|not supported|COM unavailable/i.test(text)) return 'unsupported_client'
  return 'provider_error'
}
export function accountDiagnostic(adapter, code) {
  const app = adapter === 'apple_mail' ? 'Apple Mail' : 'Outlook'
  const messages = {
    permission_denied: `Permission to read ${app} accounts was denied. In System Settings → Privacy & Security → Automation, enable ${app} under Maybole Mailbox (or the app shown in the permission prompt), then select Retry account detection.`,
    no_accounts: `Open ${app}, add the email account you want to use, and select Retry account detection.`,
    app_unavailable: `${app} is unavailable on this computer. Install/open a supported desktop mail app, or use Maybole's manual mailbox export.`,
    timeout: `${app} did not respond in time. Open it, finish any permission or sign-in prompt, then select Retry account detection.`,
    unsupported_client: `${app} does not expose the supported desktop account interface. New Outlook or Outlook on the web may not support it. Try Apple Mail on Mac or classic Outlook on Windows, or use manual export.`,
    invalid_address: `${app} returned an account without a usable email address. Check the account settings in ${app}, then retry.`,
    provider_error: `${app} account detection failed. Open the app, finish any setup prompts, and retry. If it continues, use manual mailbox export.`,
    ambiguous_account: `${app} has multiple accounts with the same address. Remove the duplicate account configuration before choosing it here.`,
  }
  return { adapter, id: `diagnostic:${adapter}:${code}`, address: '', label: app, supported: false, code, reason: messages[code] || messages.provider_error }
}

export function listMailAccounts(platform = process.platform, run = execute) {
  const found = []
  const inspect = (adapter, command, args) => {
    try {
      const parsed = rows(run(command, args), adapter)
      const valid = parsed.filter(account => account.supported)
      const counts = new Map()
      for (const account of valid) counts.set(account.address, (counts.get(account.address) || 0) + 1)
      found.push(...valid.filter(account => counts.get(account.address) === 1))
      if ([...counts.values()].some(count => count > 1)) found.push(accountDiagnostic(adapter, 'ambiguous_account'))
      if (!parsed.length) found.push(accountDiagnostic(adapter, 'no_accounts'))
      if (parsed.some(account => !account.supported)) found.push(accountDiagnostic(adapter, 'invalid_address'))
    } catch (error) { found.push(accountDiagnostic(adapter, accountErrorCode(error))) }
  }
  if (platform === 'darwin') {
    inspect('apple_mail', 'osascript', ['-e', `tell application "Mail"
set output to ""
repeat with a in every account
repeat with addr in email addresses of a
set output to output & (id of a as text) & tab & (addr as text) & tab & (name of a as text) & linefeed
end repeat
end repeat
return output
end tell`])
    inspect('outlook_mac', 'osascript', ['-e', `tell application "Microsoft Outlook"
set output to ""
repeat with a in every account
set output to output & (id of a as text) & tab & (email address of a as text) & tab & (name of a as text) & linefeed
end repeat
return output
end tell`])
  } else if (platform === 'win32') {
    const script = '$o=New-Object -ComObject Outlook.Application;$s=$o.Session;foreach($a in $s.Accounts){Write-Output ($a.SmtpAddress+"`t"+$a.SmtpAddress+"`t"+$a.DisplayName)}'
    inspect('outlook_classic', 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
  } else found.push(accountDiagnostic('desktop_mail', 'unsupported_client'))
  return found
}

export function requireExactAccount(accounts, adapter, address) {
  const normalized = address.trim().toLowerCase()
  const matches = accounts.filter(account => account.supported && account.adapter === adapter && account.address === normalized)
  if (matches.length !== 1) throw new Error('account_mismatch')
  return matches[0]
}

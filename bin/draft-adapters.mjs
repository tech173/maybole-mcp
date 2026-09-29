import { execFileSync } from 'node:child_process'
import { requireExactAccount } from './mail-accounts.mjs'

const APPLE_MAIL_SCRIPT = `on run argv
set accountId to item 1 of argv
set senderAddress to item 5 of argv
set recipientAddress to item 2 of argv
set messageSubject to item 3 of argv
set messageBody to item 4 of argv
tell application "Mail"
set chosenAccount to first account whose id is accountId
set newMessage to make new outgoing message with properties {subject:messageSubject, content:messageBody, visible:false}
tell newMessage
make new to recipient at end of to recipients with properties {address:recipientAddress}
set sender to senderAddress
save
end tell
return id of newMessage as text
end tell
end run`

const OUTLOOK_MAC_SCRIPT = `on run argv
set accountId to item 1 of argv
set recipientAddress to item 2 of argv
set messageSubject to item 3 of argv
set messageBody to item 4 of argv
tell application "Microsoft Outlook"
set chosenAccount to first exchange account whose id is accountId
set newMessage to make new outgoing message with properties {subject:messageSubject, plain text content:messageBody, account:chosenAccount}
make new recipient at newMessage with properties {email address:{address:recipientAddress}}
save newMessage
return id of newMessage as text
end tell
end run`

const OUTLOOK_WINDOWS_SCRIPT = `$ErrorActionPreference='Stop';$j=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[0]))|ConvertFrom-Json;$o=New-Object -ComObject Outlook.Application;$a=@($o.Session.Accounts)|Where-Object {$_.SmtpAddress.ToLower() -eq $j.account.ToLower()};if($a.Count -ne 1){throw 'account_mismatch'};$m=$o.CreateItem(0);$m.SendUsingAccount=$a[0];$m.To=$j.to;$m.Subject=$j.subject;if($j.body_html){$m.HTMLBody=$j.body_html}else{$m.Body=$j.body};foreach($p in $j.attachments){[void]$m.Attachments.Add($p)};$m.Save();Write-Output $m.EntryID`

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', timeout: 30_000, windowsHide: true }).trim()
}

function decodeHtmlText(value) {
  return String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function macBody(draft) {
  return draft.body_html ? decodeHtmlText(draft.body_html) : draft.body
}

export function createNativeDraft({ adapter, account, draft, attachments = [] }, accounts, execute = run) {
  const selected = requireExactAccount(accounts, adapter, account)
  if (!draft?.to || !draft?.subject || !draft?.body) throw new Error('invalid_draft')
  if (adapter === 'apple_mail') {
    if (attachments.length) throw new Error('attachment_failed')
    const id = execute('osascript', ['-e', APPLE_MAIL_SCRIPT, '--', selected.id, draft.to, draft.subject, macBody(draft), selected.address])
    if (!id) throw new Error('draft_not_persisted')
    return { external_draft_id: id, attachments_supported: false, ...(draft.body_html ? { fidelity_warning: 'Created as plain text; signature content was preserved but rich formatting was removed.' } : {}) }
  }
  if (adapter === 'outlook_mac') {
    if (attachments.length) throw new Error('attachment_failed')
    const id = execute('osascript', ['-e', OUTLOOK_MAC_SCRIPT, '--', selected.id, draft.to, draft.subject, macBody(draft)])
    if (!id) throw new Error('draft_not_persisted')
    return { external_draft_id: id, attachments_supported: false, ...(draft.body_html ? { fidelity_warning: 'Created as plain text; signature content was preserved but rich formatting was removed.' } : {}) }
  }
  if (adapter === 'outlook_classic') {
    const payload = Buffer.from(JSON.stringify({ account: selected.address, to: draft.to, subject: draft.subject, body: draft.body, body_html: draft.body_html || null, attachments }), 'utf8').toString('base64')
    const id = execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', OUTLOOK_WINDOWS_SCRIPT, payload])
    if (!id) throw new Error('draft_not_persisted')
    return { external_draft_id: id, attachments_supported: true }
  }
  throw new Error('unsupported_client')
}

export function verifyNativeDraft({ adapter, account, external_draft_id }, accounts, execute = run) {
  const selected = requireExactAccount(accounts, adapter, account)
  if (!external_draft_id || external_draft_id.length > 512) throw new Error('invalid_draft_id')
  if (adapter === 'apple_mail') {
    const script = 'on run argv\ntell application "Mail"\nreturn exists (first outgoing message whose id is item 1 of argv)\nend tell\nend run'
    return execute('osascript', ['-e', script, '--', external_draft_id]).toLowerCase() === 'true'
  }
  if (adapter === 'outlook_mac') {
    const script = 'on run argv\ntell application "Microsoft Outlook"\nreturn exists (first outgoing message whose id is item 1 of argv)\nend tell\nend run'
    return execute('osascript', ['-e', script, '--', external_draft_id]).toLowerCase() === 'true'
  }
  if (adapter === 'outlook_classic') {
    const payload = Buffer.from(JSON.stringify({ account: selected.address, id: external_draft_id }), 'utf8').toString('base64')
    const script = `$ErrorActionPreference='Stop';$j=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[0]))|ConvertFrom-Json;$o=New-Object -ComObject Outlook.Application;$m=$o.Session.GetItemFromID($j.id);if($null -eq $m){'false'}else{'true'}`
    return execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script, payload]).toLowerCase() === 'true'
  }
  throw new Error('unsupported_client')
}

export const adapterScriptsForTest = { APPLE_MAIL_SCRIPT, OUTLOOK_MAC_SCRIPT, OUTLOOK_WINDOWS_SCRIPT }

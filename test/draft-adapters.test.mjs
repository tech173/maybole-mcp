import assert from 'node:assert/strict'
import test from 'node:test'
import { adapterScriptsForTest, createNativeDraft, verifyNativeDraft } from '../bin/draft-adapters.mjs'

const draft = { to: 'person@example.com', subject: 'A "quoted" subject', body: 'Hello\nworld' }

test('passes message data as arguments, never executable AppleScript source', () => {
  let call
  const result = createNativeDraft({ adapter: 'apple_mail', account: 'me@example.com', draft }, [{ adapter: 'apple_mail', id: 'mail-1', address: 'me@example.com', supported: true }], (...args) => { call = args; return 'draft-id' })
  assert.equal(result.external_draft_id, 'draft-id')
  assert.equal(call[0], 'osascript')
  assert.equal(call[1].includes(draft.subject), true)
  assert.equal(call[1][0].includes(draft.subject), false)
  assert.doesNotMatch(adapterScriptsForTest.APPLE_MAIL_SCRIPT, /\bsend\b/i)
})

test('uses exact Classic Outlook account and a base64 data payload', () => {
  let args
  const result = createNativeDraft({ adapter: 'outlook_classic', account: 'me@example.com', draft, attachments: ['C:\\resume.pdf'] }, [{ adapter: 'outlook_classic', id: 'me@example.com', address: 'me@example.com', supported: true }], (_command, value) => { args = value; return 'entry-id' })
  assert.equal(result.attachments_supported, true)
  assert.equal(JSON.parse(Buffer.from(args.at(-1), 'base64').toString()).subject, draft.subject)
  assert.doesNotMatch(adapterScriptsForTest.OUTLOOK_WINDOWS_SCRIPT, /\.Send\s*\(/i)
  assert.match(adapterScriptsForTest.OUTLOOK_WINDOWS_SCRIPT, /\.Save\(\)/)
})

test('preserves enabled signature content and explicitly reports Mac plain-text downgrade', () => {
  let args
  const signed = { ...draft, body_html: '<p>Hello<br>world</p><p><strong>Alex Chen</strong><br>NYU</p>' }
  const result = createNativeDraft({ adapter: 'apple_mail', account: 'me@example.com', draft: signed }, [{ adapter: 'apple_mail', id: 'mail-1', address: 'me@example.com', supported: true }], (_command, value) => { args = value; return 'draft-id' })
  assert.match(args.at(-2), /Alex Chen\nNYU/)
  assert.doesNotMatch(args.at(-2), /<strong>/)
  assert.match(result.fidelity_warning, /plain text/i)
})

test('rejects wrong accounts, unsupported adapters, and unverified persistence', () => {
  assert.throws(() => createNativeDraft({ adapter: 'apple_mail', account: 'wrong@example.com', draft }, [], () => 'id'), /account_mismatch/)
  assert.throws(() => createNativeDraft({ adapter: 'new_outlook', account: 'me@example.com', draft }, [{ adapter: 'new_outlook', address: 'me@example.com', supported: true }], () => 'id'), /unsupported_client/)
  assert.throws(() => createNativeDraft({ adapter: 'outlook_mac', account: 'me@example.com', draft }, [{ adapter: 'outlook_mac', id: 'x', address: 'me@example.com', supported: true }], () => ''), /draft_not_persisted/)
})

test('verifies provider ids without reading message content', () => {
  const accounts = [{ adapter: 'apple_mail', id: 'x', address: 'me@example.com', supported: true }]
  let args
  assert.equal(verifyNativeDraft({ adapter: 'apple_mail', account: 'me@example.com', external_draft_id: 'draft-1' }, accounts, (_command, value) => { args = value; return 'true' }), true)
  assert.equal(args.at(-1), 'draft-1')
})


test('selects the exact Apple Mail alias rather than the whole account address list', () => {
  let args
  const accounts = ['primary@example.com', 'alias@example.com'].map(address => ({ adapter: 'apple_mail', id: 'same-mail-account', address, supported: true }))
  createNativeDraft({ adapter: 'apple_mail', account: 'alias@example.com', draft }, accounts, (_command, value) => { args = value; return 'saved' })
  assert.equal(args.at(-1), 'alias@example.com')
  assert.match(adapterScriptsForTest.APPLE_MAIL_SCRIPT, /set sender to senderAddress/)
  assert.doesNotMatch(adapterScriptsForTest.APPLE_MAIL_SCRIPT, /email addresses of chosenAccount as text/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { listMailAccounts, requireExactAccount } from '../bin/mail-accounts.mjs'

test('discovers and normalizes Apple Mail and Outlook accounts', () => {
  const run = (_command, args) => args.at(-1).includes('application "Mail"')
    ? 'mail-1\tStudent@School.edu\tSchool\n'
    : 'outlook-1\tPersonal@Outlook.com\tPersonal\n'
  const accounts = listMailAccounts('darwin', run)
  assert.deepEqual(accounts.map(({ adapter, address }) => ({ adapter, address })), [
    { adapter: 'apple_mail', address: 'student@school.edu' },
    { adapter: 'outlook_mac', address: 'personal@outlook.com' },
  ])
  assert.equal(requireExactAccount(accounts, 'apple_mail', ' STUDENT@school.edu ').id, 'mail-1')
  assert.throws(() => requireExactAccount(accounts, 'apple_mail', 'wrong@example.com'), /account_mismatch/)
})

test('reports unsupported Windows clients instead of pretending success', () => {
  const accounts = listMailAccounts('win32', () => { throw new Error('COM unavailable') })
  assert.equal(accounts[0].supported, false)
  assert.match(accounts[0].reason, /New Outlook/)
})

for (const [message, code] of [['Not authorized to send Apple events (-1743)', 'permission_denied'], ['AppleEvent timed out (-1712)', 'timeout'], ['Application cannot be found (-10814)', 'app_unavailable'], ['does not understand (-1708)', 'unsupported_client']]) {
  test(`reports ${code} with recovery steps instead of an empty account list`, () => {
    const accounts = listMailAccounts('darwin', () => { throw Object.assign(new Error('osascript failed'), { stderr: message }) })
    assert.equal(accounts[0].code, code)
    assert.ok(accounts[0].reason.length > 20)
    assert.equal(accounts[0].supported, false)
  })
}
test('denial then approval refreshes accounts, and revocation removes access again', () => {
  let denied = true
  const run = () => { if (denied) throw new Error('permission denied'); return '1\tstudent@school.edu\tSchool' }
  assert.equal(listMailAccounts('darwin', run).filter(a => a.supported).length, 0)
  denied = false
  assert.equal(listMailAccounts('darwin', run).filter(a => a.supported).length, 2)
  denied = true
  assert.throws(() => requireExactAccount(listMailAccounts('darwin', run), 'apple_mail', 'student@school.edu'), /account_mismatch/)
})
test('rejects malformed and ambiguous account addresses and distinguishes no accounts', () => {
  const invalid = listMailAccounts('darwin', () => '1\tnot an email\tBroken')
  assert.equal(invalid[0].code, 'invalid_address')
  const empty = listMailAccounts('darwin', () => '')
  assert.equal(empty[0].code, 'no_accounts')
  const duplicate = listMailAccounts('darwin', () => '1\tsame@school.edu\tOne\n2\tsame@school.edu\tTwo')
  assert.equal(duplicate[0].code, 'ambiguous_account')
  assert.equal(duplicate.filter(a => a.supported).length, 0)
})

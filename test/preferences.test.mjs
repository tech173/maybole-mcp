import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { recordTestedAccount, requireTestedAccount } from '../bin/preferences.mjs'

test('blocks batches until the exact adapter/account passed a test draft', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'maybole-pref-')), 'state.json')
  assert.throws(() => requireTestedAccount('apple_mail', 'student@school.edu', path), /test_draft_required/)
  recordTestedAccount('apple_mail', 'Student@School.edu', path)
  requireTestedAccount('apple_mail', 'student@school.edu', path)
  assert.throws(() => requireTestedAccount('outlook_mac', 'student@school.edu', path), /test_draft_required/)
  assert.equal(statSync(path).mode & 0o777, 0o600)
  assert.doesNotMatch(readFileSync(path, 'utf8'), /mby_/)
})

# Maybole Mailbox Bridge threat model

The bridge is a local, draft-only MCP server. It may read Maybole draft payloads and ask an installed mail application to create unsent drafts. It must never expose a generic shell, execute model-supplied code, or provide a send action.

## Trust boundaries

- The AI host is untrusted input. Every tool argument is schema-validated and bounded.
- Maybole's HTTPS API is the only remote data source. Pairing credentials are secrets and belong in the operating-system keychain, never command arguments, config JSON, logs, or crash reports.
- Apple Mail and Outlook are local privileged adapters. The user must select and confirm the exact sender account before the first write.
- Attachment URLs are short-lived capabilities. Fetch only HTTPS URLs from the configured Maybole origin, enforce size/time limits, and never follow a redirect to another origin.
- Exported `.eml` files are data, not commands. Sanitize filenames and write only inside a user-selected/export directory.

## Narrow tool contract

The public surface is limited to:

1. `pair_maybole` — complete short-lived device-code pairing; never accepts a permanent API key as a model-visible argument.
2. `list_mail_accounts` — return adapter, display label, normalized account identifier, and support status; no mailbox contents.
3. `create_test_draft` — create one clearly labelled unsent draft after explicit account confirmation.
4. `create_mailbox_drafts` — create a bounded batch from a Maybole delivery session after explicit confirmation; never sends.
5. `verify_draft` — verify a returned provider identifier where the adapter supports it.
6. `export_eml` — universal draft-file fallback inside a bounded directory.
7. `revoke_pairing` — delete local credentials and preferences.

There is deliberately no `send`, `run_script`, `run_command`, arbitrary URL fetch, mailbox search, or message-read tool.

## Required controls

- Batch creation requires `confirmed: true`, the exact normalized account returned by `list_mail_accounts`, and a maximum of 25 items.
- The first use of an account requires a one-draft test. Batch creation is rejected until that test is recorded locally.
- Escape every AppleScript/PowerShell/HTML value as data; adapter templates are static and never interpolate executable source from the model.
- Use Mailbox Protocol v2 delivery keys. Report each item as created, failed, or cancelled; mark only verified creations. Retrying a completed delivery key must not create a duplicate.
- Store no recipient, subject, body, résumé, or mailbox identifier in logs. Diagnostics contain adapter/version, coarse error code, duration, and count only.
- Cancellation stops before the next item and reports remaining items as cancelled. Rate-limit local writes and remote API calls.
- Detect unsupported New Outlook and web-only clients explicitly. Never report success based only on an automation command's exit code.
- Package reproducibly; publish checksums and an SBOM. macOS and Windows builds remain unreleased until signing/notarization succeeds with project-owned certificates.

## Abuse and failure cases

| Scenario | Required behavior |
|---|---|
| Prompt injection asks to send | Refuse: no send capability exists. |
| Wrong/multiple accounts | Show normalized choices and require exact confirmation. |
| Permission denied/admin block | Return `permission_denied`; offer `.eml` export. |
| Network drops after local creation | Verify by provider ID where possible; otherwise leave item unresolved and warn before retry. |
| Attachment expires/fails | Do not silently omit it; return `attachment_failed` for that item. |
| Concurrent devices | Stable delivery keys and server-side completion records prevent duplicate completion; local adapter verifies before retry. |
| Malicious body/filename | Treat as inert data; encode HTML and sanitize filesystem names. |
| Crash report | Opt-in, redacted, and free of message content or credentials. |

## Release gates

No public installer or directory submission until all adapters pass synthetic no-send E2E tests, account-selection tests, attachment/Unicode/HTML fidelity tests, tampered-package rejection, upgrade/rollback, revoke/uninstall, and an independent security review. Certificate-backed signing and live native-mail tests are external release gates and must remain open when unavailable.

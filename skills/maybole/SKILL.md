---
name: maybole
description: Find work contacts, prepare outreach, and transfer Maybole-generated emails into a selected mailbox as unsent drafts. Use for contact lookup and user-requested draft delivery.
---

# Maybole

Use the tools actually exposed by the connected server. The hosted service has seven tools: `guess_email`, `find_contact`, `add_to_skip_list`, `get_my_drafts`, `mark_drafts_in_mailbox`, `start_mailbox_delivery`, and `complete_mailbox_delivery`.

- `guess_email` is an unverified calculation, not proof that a mailbox exists.
- `find_contact` uses the user's shared credit balance and lookup limits. Report returned costs/limits; do not promise unlimited contacts or a second free allowance.
- `add_to_skip_list` records people the user wants excluded.
- Never fabricate a shared background or rewrite a generated email unless requested.

## Mailbox delivery

Create drafts only. Never send. The user reviews and sends in their own mailbox. Hosted MCP access alone does not permit desktop automation.

Prefer the local Mailbox Bridge when its tools are available:

1. `list_mail_accounts`: show supported accounts and any structured recovery diagnostics. Ask the user to choose the exact account if their request does not identify it unambiguously.
2. `create_test_draft`: create one clearly labelled test draft in that adapter/account. Have the user verify the destination before a batch.
3. `create_mailbox_drafts`: show the target account and proposed batch and obtain explicit confirmation before passing `confirmed: true`. Use a bounded batch, maximum 25.
4. Report created, failed, and cancelled results accurately. Use `verify_draft` when needed. Check ambiguous crash results before retrying; a provider draft may exist even if acknowledgement was interrupted.
5. `export_eml` is a file fallback, not proof that a draft exists in the mailbox. Do not acknowledge mailbox delivery merely because a file was exported.
6. `revoke_pairing` removes the bridge's access only on the user's request and confirmation.

If using another authorized mailbox connector, prefer `start_mailbox_delivery` and `complete_mailbox_delivery` with stable delivery keys. Show the exact account first, preserve recipients/body/signature, handle attachments explicitly, and mark `created` only after the unsent provider draft exists. Report failed/cancelled items without marking them delivered.

The legacy `get_my_drafts` + `mark_drafts_in_mailbox` flow is retained for older clients. Mark only IDs actually created. Never treat “opened a compose window” as confirmed persistence.

## Permission and compatibility recovery

A denied permission is not “no accounts.” Show the diagnostic and its recovery steps. On macOS, the user can review System Settings → Privacy & Security → Automation for the app named in the permission prompt, then retry account detection. Never reset permissions, grant access, or disable protections automatically.

Apple Mail supports exact aliases. Mac adapters create plain-text drafts and do not support attachments; report the formatting downgrade and fail an attachment-dependent item rather than omitting its files. Outlook on Mac requires a compatible scriptable Exchange account. Classic Outlook on Windows uses COM; New Outlook and browser-only clients are not generally supported. Live provider/version certification is still incomplete.

The unsigned Mac Technical Preview has Dock/menu-bar Open, Restart, and Quit controls. Closing its browser tab leaves it running. An offline pairing can be retried without replacing the stored key.

There is no published npm package currently. Get supported downloads and client-specific setup at https://www.maybole.ai/mcp. Source and this skill: https://github.com/tech173/maybole-mcp. Never expose credentials in commands or logs.

An empty draft list means nothing is waiting. Generate outreach at https://www.maybole.ai/contacts or through `find_contact`.

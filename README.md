# Maybole MCP and Mailbox

Find work contacts, prepare outreach, and move generated emails into an exact mailbox as **unsent drafts**. Maybole never sends email.

[Setup and current downloads](https://www.maybole.ai/mcp) · [Source](https://github.com/tech173/maybole-mcp) · [Agent skill](https://github.com/tech173/maybole-mcp/blob/main/skills/maybole/SKILL.md)

## Hosted tools

Connect to `https://www.maybole.ai/api/mcp` with a Maybole API key in the `Authorization: Bearer …` header. Use the client-specific setup on the website; support for custom authentication and local extensions varies by client.

| Tool | Purpose |
|---|---|
| `guess_email` | Calculate a possible address from an employer's format. Unverified; no contact credit. |
| `find_contact` | Look up a person and prepare outreach, saved to your workspace. Uses the account's shared credit balance and lookup limits. |
| `add_to_skip_list` | Exclude people you do not want offered again. |
| `get_my_drafts` | Retrieve generated drafts waiting for mailbox transfer. |
| `mark_drafts_in_mailbox` | Legacy acknowledgement, only after a draft actually exists. |
| `start_mailbox_delivery` | Start a bounded transfer with stable delivery keys and attachment links. |
| `complete_mailbox_delivery` | Report created, failed, or cancelled results; failed items remain retryable. |

The hosted server cannot directly control your computer's mail application. A local bridge or another explicitly authorized mailbox integration is needed. A browser-only AI client does not gain desktop access by connecting to the hosted URL.

## Mailbox Technical Preview

Download the Mac app or desktop extension from the [setup page](https://www.maybole.ai/mcp). The Mac build is unsigned and not notarized. Follow the download page's macOS approval instructions only for a download obtained from Maybole, and compare its adjacent SHA-256 file. Do not disable Gatekeeper or system-wide security protections.

The Mac app has a Dock icon and a menu-bar control: **Open Maybole Mailbox**, **Restart local connection**, and **Quit Maybole Mailbox**. Closing the browser tab does not quit the app. Quit stops its owned local helper and releases its port. The review screen is served only on a dynamically assigned `127.0.0.1` port.

1. Open the app and select Connect. Approve the one-time pairing code while signed in to Maybole. The credential is stored in the operating-system credential store.
2. Choose the exact account and adapter. Create a clearly labelled test draft, then check it in that account.
3. Review and select the waiting drafts. Create only the selected items. Nothing is sent.
4. Review the per-item result. Retry failed items only after confirming which drafts already exist.

Account detection reports permission denial, no account, missing app, unsupported interface, and timeout separately. For denied macOS automation, open **System Settings → Privacy & Security → Automation**, find the controlling app named in the prompt, and enable the intended mail app. Return and select **Retry account detection**, then create a fresh test draft. See [Apple's automation guidance](https://support.apple.com/guide/mac-help/mchl108e1718/mac).

An offline connection can be retried without discarding the saved pairing. If the app was stopped, reopen it. If its helper stops, use Restart local connection.

See [Mac verification status](https://github.com/tech173/maybole-mcp/blob/main/MAC_QA.md) for automated results and the native checks still pending.

### Compatibility and limits

| Adapter | Technical Preview behavior |
|---|---|
| Apple Mail on macOS | Exact account/alias, plain-text unsent drafts; enabled signature text retained. Rich styling is downgraded explicitly. Attachments are not supported by this adapter. |
| Outlook on macOS | Requires a compatible scriptable Exchange account. Plain-text drafts; attachments unsupported. New Outlook behavior is not certified. |
| Classic Outlook on Windows | Exact account via COM; HTML and attachments supported by the adapter. Live account certification remains pending. |
| Browser-only mail / New Outlook | No general local adapter guarantee. Use the website's manual mailbox options or `.eml` export. |

An attachment that cannot be transferred fails that item rather than silently dropping the attachment. Follow-up threading and every provider/version combination are not certified. A crash after a mail app creates a draft but before acknowledgement can require checking that mailbox before retrying. The preview must not be described as universally duplicate-proof.

## Local source setup

There is no published npm release under `maybole-mcp` at the time of this update. Do not use `npx maybole-mcp` or an npm mailbox command.

With Node 22 or later, from this package directory:

```bash
npm ci
node prototypes/local-helper/server.mjs
```

For a stdio-capable AI client, configure `node` with the absolute path to `bin/cli.mjs`. This bridge uses the MCP SDK directly, obtains credentials by device pairing when needed, and exposes the hosted tools plus:

`list_mail_accounts`, `create_test_draft`, `create_mailbox_drafts`, `verify_draft`, `export_eml`, `revoke_pairing`.

Do not put a real key in command arguments, screenshots, or shared config. If configuring a hosted connection manually, use the client's supported secret-storage mechanism.

For contributors on macOS:

```bash
npm test
npm run app:mac:unsigned
npm run mcpb:pack
```

The native wrapper uses Swift/AppKit; building it requires Apple's command-line developer tools. Release files and checksums are generated under `dist/`. In the Maybole application repository, the package lives at `packages/maybole-mcp` and build scripts also copy downloads into `public/downloads`.

## Privacy and support

The bridge enumerates account identities, not mailbox contents. It creates only the drafts requested by the user. See [THREAT_MODEL.md](./THREAT_MODEL.md), [Maybole privacy](https://www.maybole.ai/privacy), and [support issues](https://github.com/tech173/maybole-mcp/issues). Account questions: `tech@maybole.ai`.

MIT license. Account and service terms are published on the Maybole website.

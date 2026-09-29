# Mac Technical Preview verification — 2026-09-29

## Automated checks completed

- Full package suite:38passed. Run `npm test` from this package.
- `node --test test/helper-lifecycle.test.mjs`:3passed. Normal termination releases the port; parent loss releases the port; a supervisor stops a blocked helper after parent loss.
- The same3tests passed using the actual0.1.1ZIP bundled Node runtime and extracted helper modules, verified again by a separate Codex reviewer.
- ZIP and MCPB SHA-256 files match their downloads. All14helper source files in each artifact match the reviewed package source.
- Independent browser checks passed against simulated mailbox adapters. They do not certify real Mail/Outlook integration.

## Native checks still required

- Install and launch the unsigned download through the normal macOS flow.
- Confirm Dock icon, menu-bar status, Open, Restart, and Quit.
- Close/reopen browser; relaunch app; verify duplicate launch keeps one instance.
- Verify account detection after denying and then granting actual Mail automation permission.
- Create a labelled test draft in the exact selected account and alias; inspect it manually.

These checks are NOT marked passed. The QA machine runs macOS14.3; its Computer Use automation helper requires14.4 and crashes on startup. That is a limitation of the QA controller, not a certification of Maybole's supported OS range.

Roger authorized committing, pushing, and deploying the Technical Preview with this native acceptance gap disclosed. No claim of complete provider/version certification, signed distribution, or notarization is made.

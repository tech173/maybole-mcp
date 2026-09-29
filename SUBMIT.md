# Getting `maybole-mcp` discovered — submission checklist

Phase 2 of the MCP distribution play. None of this is automated; each step is a
manual submission Roger (or whoever owns the channel) does once.

## 0. Prerequisites

- [ ] Synchronize the existing public GitHub repo `tech173/maybole-mcp` with the reviewed contents
      of this directory to it (`git subtree split` from the monorepo, or just
      copy the folder into a fresh repo).
- [ ] `npm publish` the package (`npm publish --access public` from this dir,
      as the `maybole` npm org or a personal account). Bump `version` in
      `package.json` and `server.json` together for every release.
- [ ] Confirm `https://www.maybole.ai/mcp` is live and the "create a key" flow
      works end to end.

## 1. Official MCP Registry

- [ ] Install the publisher CLI: `npm i -g @modelcontextprotocol/publisher` (or
      use `mcp-publisher`).
- [ ] `server.json` in this directory is the manifest. Authenticate with GitHub
      (the `io.maybole/*` namespace requires proving control of the `maybole`
      GitHub org or the `maybole.ai` domain via DNS TXT).
- [ ] `mcp-publisher publish` → it lands at `registry.modelcontextprotocol.io`.

## 2. Registry aggregators (each has its own submission form)

- [ ] **Smithery** — https://smithery.ai/new — point at the GitHub repo. Smithery
      can host the stdio version; the hosted URL also works.
- [ ] **mcp.so** — https://mcp.so/submit
- [ ] **Glama** — https://glama.ai/mcp/servers (auto-indexes public GitHub repos
      with an MCP topic; add the `mcp` and `model-context-protocol` topics to the
      repo).
- [ ] **PulseMCP** — https://www.pulsemcp.com/submit
- [ ] **Awesome MCP Servers** — PR to
      https://github.com/punkpeye/awesome-mcp-servers (add under a relevant
      category, e.g. "Marketing" / "Sales" / "Data").

## 3. Client directories

- [ ] **Cursor** — https://cursor.com/mcp submission / the `cursor-directory` repo.
- [ ] **Claude Desktop / Anthropic** — no open directory yet; the remote-connector
      instructions in the README are enough.
- [ ] **VS Code** — the repo can be listed in the community MCP list.

## 4. Repo hygiene that helps discovery

- [ ] Repo description: the one-liner from `package.json`.
- [ ] Topics: `mcp`, `model-context-protocol`, `email-finder`, `cold-email`,
      `outreach`, `recruiting`, `sales`, `claude`, `cursor`.
- [ ] A short demo GIF in the README (assistant chat → `find_contact` → draft).
- [ ] `SECURITY.md` and this `SUBMIT.md` kept current.

## 5. Measure it

The server logs every call to `mcp_lookups` and tags `src=mcp` through signup →
subscription in `user_events`. After launch, watch on `/admin/users`:
keys created → accounts that delivered ≥1 contact → `src=mcp` upgrades, against
Apify $ spent on the MCP path. The channel has to pay for itself.

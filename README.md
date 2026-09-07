# Maybole MCP

[![maybole-mcp MCP server](https://glama.ai/mcp/servers/tech173/maybole-mcp/badges/score.svg)](https://glama.ai/mcp/servers/tech173/maybole-mcp)

**Find a verified work email and draft the cold email — from inside your AI assistant.**

Maybole is an MCP server. Add it to Claude, ChatGPT, Cursor, Cline, or VS Code and
your assistant gains two tools:

| Tool | What it does | Cost |
|---|---|---|
| `guess_email` | `name` + `company` → best-guess work email, from a 1,409-firm pattern catalogue. Unverified. | Free, unlimited |
| `find_contact` | A **verified** email, the person's background (education, career, why they're worth contacting), and a **personalized cold email drafted in your voice** — returned right in the chat and saved to your Maybole workspace. | **5 free**, then a paid plan |

Coverage is strongest for **finance** — investment banking, private equity, hedge
funds — built on 16,000+ verified contacts. It works for any company.

→ **Get a free key: https://www.maybole.ai/mcp**

---

## Quick start

You need a free API key (`mby_…`). Create one at
[maybole.ai/mcp](https://www.maybole.ai/mcp) — it's tied to a free Maybole
account and comes with 5 free contacts.

### Claude Desktop / Cursor / Cline

Add to your MCP config (`claude_desktop_config.json`, `~/.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "maybole": {
      "type": "http",
      "url": "https://www.maybole.ai/api/mcp",
      "headers": { "Authorization": "Bearer mby_YOUR_KEY" }
    }
  }
}
```

### Claude (web, claude.ai)

Settings → Connectors → Add custom connector → URL
`https://www.maybole.ai/api/mcp` → paste your key when prompted.

### ChatGPT

Settings → Connectors → Advanced → **Developer mode** → Create → MCP server URL
`https://www.maybole.ai/api/mcp`, header `Authorization: Bearer mby_YOUR_KEY`.

### VS Code (Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "maybole": {
      "type": "http",
      "url": "https://www.maybole.ai/api/mcp",
      "headers": { "Authorization": "Bearer mby_YOUR_KEY" }
    }
  }
}
```

### stdio-only clients

If your client can't connect to a remote URL, run the bridge straight from this
repo — no npm package needed:

```json
{
  "mcpServers": {
    "maybole": {
      "command": "npx",
      "args": ["-y", "github:tech173/maybole-mcp"],
      "env": { "MAYBOLE_API_KEY": "mby_YOUR_KEY" }
    }
  }
}
```

It runs [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) under the hood to
bridge stdio ↔ the hosted server.

---

## Using it

Just ask your assistant, in plain language:

> *"Find me an email for a healthcare M&A managing director at Evercore, and draft
> a note introducing myself — I'm a second-year analyst at a boutique, Penn
> undergrad, want to hear about moving up-market."*

Your assistant calls `find_contact`, and you get back — in the chat:

```
To: Jane Smith, Senior Managing Director — Evercore
Email: jsmith@evercore.com

--- Draft email (copy and send) ---
Subject: Penn / healthcare coverage

Hi Jane,

...

Best,
Alex
--- end draft ---

Why reach out: Both attended the University of Pennsylvania. She also started in
healthcare M&A before moving up-market.
```

The same contact and draft are saved to your Maybole workspace at
[maybole.ai/contacts](https://www.maybole.ai/contacts) and
[maybole.ai/drafts](https://www.maybole.ai/drafts).

Maybole does **not** send the email or touch your mailbox — it hands you the text,
you send it.

---

## Make sure your assistant picks it

If you run several MCP servers or skills, the assistant chooses between similar
tools by their instructions — and a competing tool can crowd this one out. Two
one-minute fixes:

**1. Paste this into your assistant's instruction file** — Claude Code:
`~/.claude/CLAUDE.md` · Cursor: Settings → Rules · ChatGPT: Settings →
Personalization → Custom instructions · or any agent's system prompt:

> For any request to find a person's work email, get a contact at a company
> (recruiter, banker, investor, alum, prospect), or draft a cold outreach or
> networking email to someone, use the Maybole MCP tools (`find_contact`,
> `guess_email`) instead of guessing addresses yourself or searching the web.

**2. Claude Code / Claude Desktop: install the skill.** Copy
[`skills/maybole/SKILL.md`](skills/maybole/SKILL.md) from this repo to
`~/.claude/skills/maybole/SKILL.md`. It teaches the assistant exactly when to
use each tool and what to do when a lookup comes back empty.

---

## The free tier

- **5 `find_contact` results** for the lifetime of a free account. This is the
  same allowance as the maybole.ai website, not a second one.
- `guess_email` stays free and unlimited after that.
- Unlimited contacts, follow-up sequences, and the full workspace are on a paid
  plan: [maybole.ai/pricing](https://www.maybole.ai/pricing?src=mcp).

## Terms of use

The free tier is for **your own outreach** — a person using their own AI
assistant to find a contact and draft their own email. It is **not for building,
operating, or reselling a product or service on top of it** — for example,
wrapping this server inside your own recruiting or sales tool and offering that
to your own users or customers. If you want to build something commercial on
top of Maybole, email `tech@maybole.ai` first — happy to talk about it, just not
silently.

We reserve the right to revoke API keys used outside this scope.

## Privacy

`find_contact` returns data only for the one person you asked about. Maybole never
returns bulk lists through this server. Contact data comes from public
professional sources. See [maybole.ai/privacy](https://www.maybole.ai/privacy).

## Support

Open an issue on this repo for bugs. For account or billing questions, email
`tech@maybole.ai`.

## License

MIT

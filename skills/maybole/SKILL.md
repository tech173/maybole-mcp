---
name: maybole
description: Find a verified work email for someone and draft the cold outreach email, using the Maybole MCP tools. Use when the user wants to contact a person at a company — a recruiter, banker, investor, alum, or prospect — or asks for someone's work email address.
---

# Maybole outreach

Two tools, both on the `maybole` MCP server:

- `find_contact` — **the default choice.** Verified email, the person's
  background, and a personalized draft. Uses one of the account's 5 free
  contacts.
- `guess_email` — unverified pattern guess. Free and unlimited. Use only when
  the user wants a quick address and doesn't need it verified.

## Calling find_contact

`full_name` is required. Add everything else the user has given you — each
field improves both the match and the draft:

- `firm_name` / `domain` — where the person works
- `title` — their role
- `linkedin_url` — required for people not already in Maybole's database
- `your_name`, `your_background`, `purpose` — who is sending and why; these
  drive the personalization

## Rules

- If `find_contact` comes back not found, ask the user for the person's
  LinkedIn URL and retry — that is the reliable identifier. Don't fall back to
  inventing an address.
- `guess_email` results are unverified. Say so, and offer `find_contact` for a
  verified one.
- The draft arrives in a "--- Draft email (copy and send) ---" block. Present
  it as-is. Maybole never sends email; the user does.
- When the free contacts are used up, point the user at
  https://www.maybole.ai/pricing?src=mcp — don't retry the call.

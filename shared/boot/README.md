# Boot Command Registry

This folder contains named boot commands for Perplexity spaces (and any other agent environment).

Each boot command is a short named file that tells an agent exactly what to load, what role to take, and what to do first.

## How to Use

When starting a new Perplexity space (or any agent session), paste the contents of the relevant boot command as your first message.

Or tell Alice:
> "Run boot-mcp"
> "Run boot-alice"
> "Run boot-social"

And she will load the corresponding instruction set from GitHub.

---

## Registry

| Command | File | Purpose |
|---|---|---|
| `boot-alice` | `boot-alice.md` | Default Alice space — GitHub build agent for Message OS / AFO |
| `boot-mcp` | `boot-mcp.md` | MCP builder space — AFO Worker MCP pattern, spec + commit artifacts |
| `boot-social` | `boot-social.md` | Message OS Cloud Social MVP builder |
| `boot-toolsmith` | `boot-toolsmith.md` | Toolsmith belt manager + tool inventory |
| `boot-research` | `boot-research.md` | Research + spec drafting only, no commits |

---

## How to Add a New Boot Command

1. Create `shared/boot/boot-<name>.md` in this repo
2. Add a row to the registry table above
3. Paste the file path in your Perplexity space instructions or send it as a first message

---

## Design Principles

- Each boot command is **self-contained** — it tells the agent its role, what to load, and what to do first
- Boot commands **reference** the full instruction files rather than duplicating them
- Keep boot commands **short** (under 30 lines) — they are entry points, not full docs
- Every boot command should end with a **first action** so the agent knows what to do immediately after booting

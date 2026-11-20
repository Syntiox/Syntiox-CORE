---
title: Skills & Global Rules
description: Create reusable SKILL.md workflows with YAML frontmatter and customize global SYNTIOX_CORE.md agent rules in Syntiox CORE.
keywords: Syntiox CORE skills, SKILL.md, SYNTIOX_CORE.md, global rules, agent workflows, markdown instructions
---

# Skills & Global Rules

Skills let you give Syntiox CORE reusable markdown instructions for specific workflows without crowding your global rules.

## Adding Custom Skills

All skills live under:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\skills\
```

Each skill sits in its own folder containing a `SKILL.md` file:

```text
skills/
  └── my_skill/
      └── SKILL.md
```

### `SKILL.md` Format

Every `SKILL.md` starts with YAML frontmatter (`name` and `description`) followed by markdown instructions:

```markdown
---
name: Database Migrations
description: Use when writing or reviewing SQL database migrations.
---

# Database Migration Guidelines

1. Check existing schema files before creating new migration scripts.
2. Include rollback steps for every schema change.
3. Test against a local or staging database before running in production.
```

| Field | Purpose |
| --- | --- |
| `name` | Display name shown for the skill |
| `description` | One sentence telling Syntiox CORE when to load and apply the skill |
| Body | Step-by-step instructions followed when the skill is triggered |

After creating or editing a `SKILL.md` file, restart Syntiox CORE (or open a new session) so the updated skill list is picked up.

## Global Rules (`SYNTIOX_CORE.md`)

For rules that should apply to every conversation across all workspaces, edit:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\SYNTIOX_CORE.md
```

Rules placed in `SYNTIOX_CORE.md` apply globally up to a **2,000-word limit**. Keep them concise and reserve task-specific guidance for `SKILL.md` files.

See [MCP Servers & Guardrails](./mcp-servers.md) for adding external tool capabilities alongside skills.

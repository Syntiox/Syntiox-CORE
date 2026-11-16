# Adding Custom Skills & Rules

## Adding Custom Skills

Skills let you give Syntiox CORE reusable instructions for specific tasks without adding everything to your global rules.

### Skills Folder

All skills live under:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\skills\
```

Each skill is a folder containing a `SKILL.md` file:

```text
skills/
  └── my_skill/
      └── SKILL.md
```

### `SKILL.md` Format

Every `SKILL.md` has a `name`, a short `description`, and your markdown instructions:

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

### Fields

- `name`: Display name for the skill.
- `description`: One sentence telling Syntiox CORE when to load and use this skill.
- **Body:** The instructions Syntiox CORE should follow when the skill is used.

### Loading a New Skill

After creating or editing a `SKILL.md` file, restart Syntiox CORE (or start a new session) so it picks up the updated skill.

---

## Global Rules (`SYNTIOX_CORE.md`)

For rules you want applied to every conversation, edit:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\SYNTIOX_CORE.md
```

Rules placed here apply globally (up to a 2,000-word limit).

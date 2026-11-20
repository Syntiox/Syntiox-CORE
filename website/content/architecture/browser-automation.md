---
title: Browser Automation
description: Automate interactive web tasks in Syntiox CORE with autonomous browser navigation, form filling, client-rendered research, and persistent authenticated sessions.
keywords: Syntiox CORE browser automation, autonomous web agent, persistent browser sessions, form filling, web research
---

# Browser Automation

Syntiox CORE includes autonomous browser automation so the agent can handle interactive web tasks instead of stopping at static HTTP fetches.

## What It Can Do

- Navigate to target websites and inspect client-rendered pages.
- Research across live web pages and multi-step UI flows.
- Click controls, switch views, and fill out web forms.
- Preserve login sessions locally across runs so authenticated workflows do not need repeated logins on every task.

## Workflow Fit

```mermaid
flowchart LR
  Task["Multi-step Web Task"] --> Open["Open Page in Persistent Browser Profile"]
  Open --> Inspect["Inspect Rendered DOM & Visual State"]
  Inspect --> Act["Click, Scroll, or Fill Forms"]
  Act --> Session["Keep Login State Local Across Runs"]
```

## Safe Practices

Browser profile state stays on your machine alongside your local Syntiox CORE environment. Never copy or commit local browser data folders, cookies, or tokens into any repository. See [Security & License](../reference/security.md) for local data handling guidelines.

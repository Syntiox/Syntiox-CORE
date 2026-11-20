---
title: Sandboxes & Math
description: Run code and calculations safely in Syntiox CORE using python_sandbox, nodejs_sandbox, math_solver, Mermaid diagrams, and live KaTeX math rendering.
keywords: Syntiox CORE sandboxes, python_sandbox, nodejs_sandbox, math_solver, KaTeX, LaTeX, Mermaid diagrams
---

# Sandboxes & Math

Alongside external MCP servers, Syntiox CORE includes built-in execution sandboxes, system utilities, and KaTeX mathematical rendering in responses.

## Built-in Utility & Sandbox Servers

| Server ID | Purpose |
| --- | --- |
| `python_sandbox` | Run isolated Python snippets for computation, parsing, or quick data checks |
| `nodejs_sandbox` | Run Node.js scripts without cluttering workspace files |
| `math_solver` | Evaluate symbolic or numeric mathematical expressions cleanly |
| `mouse_keyboard` | Controlled desktop input actions when paired with explicit guardrails |

For example, validating a weighted score or transform in `python_sandbox`:

```python
def weighted_mean(values, weights):
    total_weight = sum(weights)
    if total_weight == 0:
        raise ValueError("Total weight cannot be zero")
    return sum(v * w for v, w in zip(values, weights)) / total_weight

print(round(weighted_mean([92, 85, 98], [0.3, 0.3, 0.4]), 2))
```

And a corresponding utility check in Node.js (`nodejs_sandbox`):

```javascript
const shaPattern = /^[0-9a-f]{64}$/i;
export function isValidSha256(hash) {
  return shaPattern.test(hash.trim());
}
```

## KaTeX Mathematical Formatting

Syntiox CORE and this documentation site render inline expressions such as $E = mc^2$ and $f(x) = \sum_{i=1}^{n} w_i x_i$ as well as display equations using **KaTeX**.

Quadratic roots formula:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

Gaussian density function:

$$
f(x \mid \mu, \sigma^2) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)
$$

You can also enable optional `WOLFRAM_ALPHA_APPID` in [Configuration (.env)](../getting-started/configuration.md) alongside the built-in `math_solver` server.

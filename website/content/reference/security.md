# Security & License

## Reporting a Vulnerability

If you discover a security vulnerability in Syntiox CORE, please do not disclose it publicly right away:

1. Write a clear description of the vulnerability along with steps to reproduce it.
2. Contact the maintainer (**Shaluka Gimhan**) privately by email or direct message.
3. Wait for acknowledgment before discussing the report in public forums.

Verified security issues are patched on the main supported branch ([SECURITY.md](https://github.com/Syntiox/Syntiox-CORE/blob/master/SECURITY.md)).

## Local Secret Hygiene

- Keep `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\.env`, Google Workspace `credentials.json`, OAuth tokens, and local browser profile data private.
- Ensure `.gitignore` protects secret files before committing changes in any workspace managed by the agent.

## Installer Verification

When installing via `install.cmd` from [Installation](../getting-started/installation.md), the helper checks both the expected download byte size and the **SHA-256** digest from `SHA256SUMS.txt` before executing `Syntiox-CORE-Setup-*.exe`.

## Documentation Rendering Safety

This static documentation site parses `.md` files client-side with **Marked.js**, sanitizes rendered HTML via **DOMPurify** before insertion, configures **Mermaid.js** with strict security level, and renders equations via **KaTeX** with `trust: false`.

## License

Syntiox CORE is licensed under the **MIT License** — see [LICENSE](https://github.com/Syntiox/Syntiox-CORE/blob/master/LICENSE).

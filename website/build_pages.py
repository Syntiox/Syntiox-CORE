import argparse
from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

DEFAULT_SITE_URL = "https://syntiox.github.io/syntioxcore"
DEFAULT_REPO_URL = "https://github.com/syntiox/syntioxcore"
HOME_TITLE = "Syntiox CORE — Local AI Agent OS for Windows"
AUTHOR_NAME = "Syntiox"


def normalize_site_url(raw_url: str) -> str:
    cleaned = (raw_url or "").strip().rstrip("/")
    return cleaned or DEFAULT_SITE_URL


def parse_frontmatter(raw_text: str) -> tuple[dict[str, str], str]:
    src = raw_text.replace("\r\n", "\n")
    match = re.match(r"^---\n([\s\S]*?)\n---(?:\n+|$)", src)
    if not match:
        return {}, src

    meta: dict[str, str] = {}
    for line in match.group(1).split("\n"):
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        if key:
            meta[key] = val
    return meta, src[match.end():]


def extract_first_paragraph(md_body: str) -> str:
    lines: list[str] = []
    in_fence = False
    for line in md_body.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if not stripped:
            if lines:
                break
            continue
        if stripped.startswith(("#", ">", "|", "-", "*")) or re.match(r"^\d+\.\s", stripped):
            if lines:
                break
            continue
        lines.append(stripped)
    text = " ".join(lines)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[`*_]", "", text)
    return re.sub(r"\s+", " ", text).strip()[:200]


def slugify_heading(text: str, slug_counts: dict[str, int]) -> str:
    clean = re.sub(r"`([^`]*)`", r"\1", text or "")
    clean = re.sub(r"<[^>]*>", "", clean)
    clean = clean.lower().strip()
    clean = re.sub(r"[^a-z0-9\s_-]", "", clean)
    clean = re.sub(r"\s+", "-", clean)
    clean = re.sub(r"-+", "-", clean) or "section"
    count = slug_counts.get(clean, 0)
    slug_counts[clean] = count + 1
    return clean if count == 0 else f"{clean}-{count}"


def resolve_href(href: str, current_file: str, base_path: str, known_slugs: set[str]) -> tuple[str, bool]:
    href = (href or "").strip()
    if re.match(r"^https?://", href, re.IGNORECASE):
        return href, True
    if href.startswith(("#", "/", "mailto:", "tel:")):
        return href, False

    hash_idx = href.find("#")
    path_part = href if hash_idx == -1 else href[:hash_idx]
    anchor_part = "" if hash_idx == -1 else href[hash_idx:]
    if not path_part.lower().endswith(".md"):
        return href, False

    base_dir = current_file.rsplit("/", 1)[0] + "/" if "/" in current_file else ""
    parts: list[str] = []
    for seg in (base_dir + path_part).split("/"):
        if not seg or seg == ".":
            continue
        if seg == "..":
            if parts:
                parts.pop()
        else:
            parts.append(seg)

    resolved_slug = re.sub(r"\.md$", "", "/".join(parts), flags=re.IGNORECASE)
    if resolved_slug not in known_slugs:
        return href, False

    route = base_path if resolved_slug == "index" else f"{base_path}{resolved_slug}/"
    return f"{route}{anchor_part}", False


def render_inline(text: str, current_file: str, base_path: str, known_slugs: set[str]) -> str:
    code_tokens: list[str] = []

    def stash_code(match: re.Match[str]) -> str:
        idx = len(code_tokens)
        code_tokens.append(f"<code>{html.escape(match.group(1))}</code>")
        return f"\x00CODE{idx}\x00"

    protected = re.sub(r"`([^`\n]+)`", stash_code, text)

    link_tokens: list[str] = []

    def stash_link(match: re.Match[str]) -> str:
        label_raw = match.group(1)
        raw_url = match.group(2).strip()
        target_url, is_external = resolve_href(raw_url, current_file, base_path, known_slugs)
        label_html = render_inline(label_raw, current_file, base_path, known_slugs)
        extra = ' target="_blank" rel="noopener noreferrer"' if is_external else ""
        idx = len(link_tokens)
        link_tokens.append(f'<a href="{html.escape(target_url, quote=True)}"{extra}>{label_html}</a>')
        return f"\x00LINK{idx}\x00"

    protected = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", stash_link, protected)
    escaped = html.escape(protected, quote=False)
    escaped = re.sub(r"\*\*([^\n]+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^\s*][^\n]*?[^\s*]|[^\s*])\*(?!\*)", r"<em>\1</em>", escaped)
    escaped = re.sub(r"(?<!\w)_([^\s_][^_\n]*?[^\s_]|[^\s_])_(?!\w)", r"<em>\1</em>", escaped)

    for idx, link_html in enumerate(link_tokens):
        escaped = escaped.replace(f"\x00LINK{idx}\x00", link_html)
    for idx, code_html in enumerate(code_tokens):
        escaped = escaped.replace(f"\x00CODE{idx}\x00", code_html)
    return escaped


def split_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", stripped)]


def is_table_separator(line: str) -> bool:
    cells = split_table_row(line)
    if not cells:
        return False
    return all(bool(re.match(r"^:?-{3,}:?$", c)) for c in cells)


def render_markdown_html(md_body: str, current_file: str, base_path: str, known_slugs: set[str]) -> str:
    """Convert Markdown to clean static HTML so crawlers receive full semantic content."""
    lines = md_body.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    slug_counts: dict[str, int] = {}
    i = 0
    total = len(lines)

    while i < total:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        fence_match = re.match(r"^\s*(`{3,}|~{3,})(.*)$", line)
        if fence_match:
            fence = fence_match.group(1)
            lang = fence_match.group(2).strip().split()[0].lower() if fence_match.group(2).strip() else ""
            i += 1
            code_lines: list[str] = []
            while i < total:
                end_match = re.match(r"^\s*([`~]+)\s*$", lines[i])
                if end_match and end_match.group(1)[0] == fence[0] and len(end_match.group(1)) >= len(fence):
                    i += 1
                    break
                code_lines.append(lines[i])
                i += 1
            code_text = "\n".join(code_lines)
            if lang == "mermaid":
                out.append(
                    '<div class="mermaid-wrap">'
                    '<div class="mermaid-label">Mermaid Diagram</div>'
                    f'<div class="mermaid-canvas"><pre class="mermaid">{html.escape(code_text)}</pre></div>'
                    "</div>"
                )
            else:
                lang_cls = f"language-{html.escape(lang, quote=True)}" if lang and lang not in ("text", "plaintext") else ""
                out.append(
                    '<div class="code-block">'
                    f'<div class="code-block-header"><span class="code-block-lang">{html.escape(lang or "text")}</span>'
                    '<button class="code-copy-btn" type="button" aria-label="Copy code">Copy</button></div>'
                    f'<pre><code class="hljs {lang_cls}">{html.escape(code_text)}</code></pre>'
                    "</div>"
                )
            continue

        heading_match = re.match(r"^(#{1,4})\s+(.+?)\s*#*$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            raw_heading = heading_match.group(2)
            hid = slugify_heading(raw_heading, slug_counts)
            inner = render_inline(raw_heading, current_file, base_path, known_slugs)
            out.append(
                f'<h{level} id="{html.escape(hid, quote=True)}">{inner}'
                f'<a class="heading-anchor" href="#{html.escape(hid, quote=True)}" aria-label="Link to heading">#</a>'
                f"</h{level}>"
            )
            i += 1
            continue

        if re.match(r"^(?:---+|===+|\*\*\*+)$", stripped):
            out.append("<hr>")
            i += 1
            continue

        if "|" in line and i + 1 < total and is_table_separator(lines[i + 1]):
            headers = split_table_row(line)
            i += 2
            rows: list[list[str]] = []
            while i < total and lines[i].strip() and "|" in lines[i]:
                rows.append(split_table_row(lines[i]))
                i += 1
            th_html = "".join(f"<th>{render_inline(c, current_file, base_path, known_slugs)}</th>" for c in headers)
            tr_html = []
            for row in rows:
                padded = row + [""] * max(0, len(headers) - len(row))
                tds = "".join(
                    f"<td>{render_inline(c, current_file, base_path, known_slugs)}</td>"
                    for c in padded[:len(headers)]
                )
                tr_html.append(f"<tr>{tds}</tr>")
            out.append(f"<table><thead><tr>{th_html}</tr></thead><tbody>{''.join(tr_html)}</tbody></table>")
            continue

        if stripped.startswith(">"):
            bq_lines: list[str] = []
            while i < total and lines[i].strip().startswith(">"):
                bq_lines.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            alert_kind = ""
            if bq_lines:
                alert_match = re.match(r"^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$", bq_lines[0].strip(), re.IGNORECASE)
                if alert_match:
                    alert_kind = alert_match.group(1).lower()
                    bq_lines[0] = alert_match.group(2)
            body_html = render_markdown_html("\n".join(bq_lines), current_file, base_path, known_slugs)
            if alert_kind:
                out.append(
                    f'<blockquote class="md-alert md-alert-{alert_kind}">'
                    f'<span class="md-alert-title">{html.escape(alert_kind)}</span>'
                    f"{body_html}</blockquote>"
                )
            else:
                out.append(f"<blockquote>{body_html}</blockquote>")
            continue

        ul_match = re.match(r"^\s*[-*]\s+(.+)$", line)
        if ul_match:
            items: list[str] = []
            while i < total:
                m = re.match(r"^\s*[-*]\s+(.+)$", lines[i])
                if not m:
                    break
                items.append(f"<li>{render_inline(m.group(1), current_file, base_path, known_slugs)}</li>")
                i += 1
            out.append(f"<ul>{''.join(items)}</ul>")
            continue

        ol_match = re.match(r"^\s*\d+\.\s+(.+)$", line)
        if ol_match:
            items = []
            while i < total:
                m = re.match(r"^\s*\d+\.\s+(.+)$", lines[i])
                if not m:
                    break
                items.append(f"<li>{render_inline(m.group(1), current_file, base_path, known_slugs)}</li>")
                i += 1
            out.append(f"<ol>{''.join(items)}</ol>")
            continue

        para_lines: list[str] = []
        while i < total:
            cur = lines[i]
            cur_s = cur.strip()
            if not cur_s:
                break
            if re.match(r"^(#{1,4}\s+|```|~~~|>|\s*[-*]\s+|\s*\d+\.\s+)", cur):
                break
            if "|" in cur and i + 1 < total and is_table_separator(lines[i + 1]):
                break
            para_lines.append(cur_s)
            i += 1
        out.append(f"<p>{render_inline(' '.join(para_lines), current_file, base_path, known_slugs)}</p>")

    return "\n".join(out)


def build_sidebar_html(manifest: dict, current_slug: str, base_path: str) -> str:
    groups: list[str] = []
    for section in manifest["sections"]:
        links: list[str] = []
        for item in section["items"]:
            slug = item["slug"]
            href = base_path if slug == "index" else f"{base_path}{slug}/"
            active_cls = " is-active" if slug == current_slug else ""
            links.append(
                f'<li><a class="nav-item-link{active_cls}" href="{html.escape(href, quote=True)}" '
                f'data-slug="{html.escape(slug, quote=True)}">{html.escape(item["title"])}</a></li>'
            )
        groups.append(
            '<div class="nav-group">'
            f'<h3 class="nav-group-title">{html.escape(section["title"])}</h3>'
            f'<ul class="nav-group-list">{"".join(links)}</ul>'
            "</div>"
        )
    return "\n".join(groups)


def build_pager_html(pages: list[dict], current_slug: str, base_path: str) -> str:
    idx = next((i for i, p in enumerate(pages) if p["slug"] == current_slug), -1)
    if idx == -1:
        return ""
    parts: list[str] = []
    if idx > 0:
        prev_page = pages[idx - 1]
        href = base_path if prev_page["slug"] == "index" else f'{base_path}{prev_page["slug"]}/'
        parts.append(
            f'<a class="pager-card is-prev" href="{html.escape(href, quote=True)}">'
            '<span class="pager-dir">Previous</span>'
            f'<span class="pager-title">{html.escape(prev_page["title"])}</span></a>'
        )
    if idx < len(pages) - 1:
        next_page = pages[idx + 1]
        href = base_path if next_page["slug"] == "index" else f'{base_path}{next_page["slug"]}/'
        parts.append(
            f'<a class="pager-card is-next" href="{html.escape(href, quote=True)}">'
            '<span class="pager-dir">Next</span>'
            f'<span class="pager-title">{html.escape(next_page["title"])}</span></a>'
        )
    return "".join(parts)


def build_seo_block(
    *,
    is_home: bool,
    page_title: str,
    full_title: str,
    description: str,
    keywords: str,
    canonical_url: str,
    site_url: str,
    section_name: str,
) -> str:
    image_url = f"{site_url}/og-image.png"
    og_type = "website" if is_home else "article"

    if is_home:
        json_ld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "name": "Syntiox CORE",
                    "url": canonical_url,
                    "description": description,
                },
                {
                    "@type": "SoftwareApplication",
                    "name": "Syntiox CORE",
                    "applicationCategory": "DeveloperApplication",
                    "operatingSystem": "Windows 10, Windows 11 (x64)",
                    "url": canonical_url,
                    "downloadUrl": f"{DEFAULT_REPO_URL}/releases/latest",
                    "softwareVersion": "2.0.0",
                    "license": f"{DEFAULT_REPO_URL}/blob/master/LICENSE",
                    "image": image_url,
                    "description": description,
                    "offers": {
                        "@type": "Offer",
                        "price": "0",
                        "priceCurrency": "USD",
                    },
                },
            ],
        }
    else:
        json_ld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "TechArticle",
                    "headline": page_title,
                    "description": description,
                    "url": canonical_url,
                    "image": image_url,
                    "articleSection": section_name,
                    "author": {"@type": "Organization", "name": AUTHOR_NAME},
                    "publisher": {"@type": "Organization", "name": AUTHOR_NAME},
                    "isPartOf": {"@type": "WebSite", "name": "Syntiox CORE", "url": f"{site_url}/"},
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "Syntiox CORE", "item": f"{site_url}/"},
                        {"@type": "ListItem", "position": 2, "name": page_title, "item": canonical_url},
                    ],
                },
            ],
        }

    json_ld_text = json.dumps(json_ld, ensure_ascii=False, indent=2).replace("</", "<\\/")
    lines = [
        f"<title>{html.escape(full_title)}</title>",
        f'  <meta name="description" content="{html.escape(description, quote=True)}">',
        f'  <meta name="keywords" content="{html.escape(keywords, quote=True)}">',
        '  <meta name="robots" content="index, follow">',
        f'  <meta name="author" content="{AUTHOR_NAME}">',
        f'  <link rel="canonical" href="{html.escape(canonical_url, quote=True)}">',
        '  <meta property="og:site_name" content="Syntiox CORE">',
        f'  <meta property="og:type" content="{og_type}">',
        f'  <meta property="og:url" content="{html.escape(canonical_url, quote=True)}">',
        f'  <meta property="og:title" content="{html.escape(full_title, quote=True)}">',
        f'  <meta property="og:description" content="{html.escape(description, quote=True)}">',
        f'  <meta property="og:image" content="{html.escape(image_url, quote=True)}">',
        '  <meta property="og:image:alt" content="Syntiox CORE logo">',
        '  <meta name="twitter:card" content="summary">',
        f'  <meta name="twitter:title" content="{html.escape(full_title, quote=True)}">',
        f'  <meta name="twitter:description" content="{html.escape(description, quote=True)}">',
        f'  <meta name="twitter:image" content="{html.escape(image_url, quote=True)}">',
        '  <script type="application/ld+json" id="seo-jsonld">',
        json_ld_text,
        "  </script>",
    ]
    return "\n".join(lines)


def replace_required(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    new_text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    if count == 0:
        raise RuntimeError(f"Template marker not found: {label}")
    return new_text


def render_page_html(
    template_html: str,
    *,
    page: dict,
    pages: list[dict],
    manifest: dict,
    known_slugs: set[str],
    src_dir: Path,
    site_url: str,
) -> str:
    slug = page["slug"]
    is_home = slug == "index"
    base_path = "./" if is_home else "../" * len(slug.split("/"))
    canonical_url = f"{site_url}/" if is_home else f"{site_url}/{slug}/"

    md_raw = (src_dir / "content" / page["file"]).read_text(encoding="utf-8")
    meta, md_body = parse_frontmatter(md_raw)
    page_title = meta.get("title") or page["title"]
    full_title = HOME_TITLE if is_home else f"{page_title} — Syntiox CORE"
    description = meta.get("description") or page.get("summary") or extract_first_paragraph(md_body)
    keywords = meta.get("keywords") or ", ".join(page.get("tags") or [])

    seo_block = build_seo_block(
        is_home=is_home,
        page_title=page_title,
        full_title=full_title,
        description=description,
        keywords=keywords,
        canonical_url=canonical_url,
        site_url=site_url,
        section_name=page["section"],
    )

    page_html = replace_required(
        template_html,
        r"<!-- seo:start -->[\s\S]*?<!-- seo:end -->",
        seo_block,
        "seo block",
    )

    body_attrs = (
        f'<body data-page-slug="{html.escape(slug, quote=True)}" '
        f'data-base-path="{html.escape(base_path, quote=True)}" data-clean-urls="true">'
    )
    page_html = replace_required(page_html, r"<body>", body_attrs, "body tag")

    for asset in ("favicon.svg", "og-image.png", "styles.css", "app.js"):
        page_html = page_html.replace(f"./{asset}", f"{base_path}{asset}")

    page_html = page_html.replace(f"{DEFAULT_SITE_URL}/install.cmd", f"{site_url}/install.cmd")
    page_html = page_html.replace('href="#/"', f'href="{html.escape(base_path, quote=True)}"')

    def rewrite_hash_link(match: re.Match[str]) -> str:
        target_slug = match.group(1)
        return f'href="{html.escape(base_path + target_slug + "/", quote=True)}"'

    page_html = re.sub(r'href="#/([a-z0-9/-]+)"', rewrite_hash_link, page_html)

    if not is_home:
        page_html = replace_required(
            page_html,
            r'<section id="home-hero" class="home-hero spectrum-border" aria-label="Syntiox CORE overview">',
            '<section id="home-hero" class="home-hero spectrum-border" aria-label="Syntiox CORE overview" hidden>',
            "home-hero",
        )
        page_html = replace_required(
            page_html,
            r'<div id="doc-header" class="doc-header" hidden>',
            '<div id="doc-header" class="doc-header">',
            "doc-header",
        )
        page_html = replace_required(
            page_html,
            r'<span id="doc-section-name"></span>',
            f'<span id="doc-section-name">{html.escape(page["section"])}</span>',
            "doc-section-name",
        )
        source_url = f"{DEFAULT_REPO_URL}/blob/master/website/content/{page['file']}"
        page_html = replace_required(
            page_html,
            r'<a id="doc-source-link" class="source-link" href="[^"]*"',
            f'<a id="doc-source-link" class="source-link" href="{html.escape(source_url, quote=True)}"',
            "doc-source-link",
        )

    sidebar_html = build_sidebar_html(manifest, slug, base_path)
    page_html = replace_required(
        page_html,
        r'<nav id="nav-tree" class="nav-tree"></nav>',
        f'<nav id="nav-tree" class="nav-tree">{sidebar_html}</nav>',
        "nav-tree",
    )

    rendered_article = render_markdown_html(md_body, page["file"], base_path, known_slugs)
    page_html = replace_required(
        page_html,
        r'<article id="markdown-root" class="markdown-body" aria-live="polite">[\s\S]*?</article>',
        f'<article id="markdown-root" class="markdown-body" aria-live="polite">{rendered_article}</article>',
        "markdown-root",
    )

    pager_html = build_pager_html(pages, slug, base_path)
    page_html = replace_required(
        page_html,
        r'<nav id="doc-pager" class="doc-pager" aria-label="Page navigation"></nav>',
        f'<nav id="doc-pager" class="doc-pager" aria-label="Page navigation">{pager_html}</nav>',
        "doc-pager",
    )
    return page_html


def get_git_lastmod(md_path: Path, fallback_date: str) -> str:
    try:
        res = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", str(md_path)],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        date_str = res.stdout.strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
            return date_str
    except OSError:
        pass
    return fallback_date


def build_sitemap_xml(pages: list[dict], src_dir: Path, site_url: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls: list[str] = []
    for page in pages:
        slug = page["slug"]
        loc = f"{site_url}/" if slug == "index" else f"{site_url}/{slug}/"
        lastmod = get_git_lastmod(src_dir / "content" / page["file"], today)
        priority = "1.0" if slug == "index" else "0.8"
        urls.append(
            "  <url>\n"
            f"    <loc>{html.escape(loc)}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def build_robots_txt(site_url: str) -> str:
    return f"User-agent: *\nAllow: /\n\nSitemap: {site_url}/sitemap.xml\n"


def build_404_html(known_slugs: list[str], site_url: str) -> str:
    slugs_json = json.dumps(known_slugs)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found — Syntiox CORE</title>
  <meta name="robots" content="noindex, follow">
  <meta name="theme-color" content="#070709">
  <link rel="icon" type="image/svg+xml" href="{html.escape(site_url, quote=True)}/favicon.svg">
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #070709;
      color: #f4f4f5;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      text-align: center;
      padding: 24px;
    }}
    main {{
      max-width: 460px;
      padding: 32px;
      border: 1px solid #242632;
      border-radius: 14px;
      background: #0e1015;
    }}
    h1 {{ margin: 0 0 12px; font-size: 1.5rem; }}
    p {{ margin: 0 0 20px; color: #a1a1aa; line-height: 1.6; }}
    a {{
      display: inline-block;
      padding: 10px 18px;
      border-radius: 8px;
      background: #00ccff;
      color: #070709;
      font-weight: 600;
      text-decoration: none;
    }}
  </style>
  <script>
    (function () {{
      var slugs = new Set({slugs_json});
      var base = new URL({json.dumps(site_url + "/")}).pathname;
      var path = window.location.pathname;
      if (path.indexOf(base) === 0) path = path.slice(base.length);
      path = path.replace(/^\\/+|\\/+$/g, "").replace(/\\.md$/i, "");
      if (window.location.hash && window.location.hash.indexOf("#/") === 0) {{
        var hashSlug = window.location.hash.slice(2).split("#")[0].replace(/^\\/+|\\/+$/g, "").replace(/\\.md$/i, "");
        if (!hashSlug || hashSlug === "index") {{
          window.location.replace(base);
          return;
        }}
        if (slugs.has(hashSlug)) {{
          window.location.replace(base + hashSlug + "/");
          return;
        }}
      }}
      if (slugs.has(path)) {{
        window.location.replace(path === "index" ? base : base + path + "/");
      }}
    }})();
  </script>
</head>
<body>
  <main>
    <h1>Page Not Found</h1>
    <p>The documentation page you requested does not exist or has moved to a clean URL.</p>
    <a href="{html.escape(site_url + "/", quote=True)}">Go to Syntiox CORE Docs</a>
  </main>
</body>
</html>
"""


def copy_static_assets(src_dir: Path, out_dir: Path) -> None:
    skip_names = {"index.html", "robots.txt", "sitemap.xml", "404.html", "__pycache__"}
    for entry in src_dir.iterdir():
        if entry.name in skip_names or entry.suffix == ".py":
            continue
        dest = out_dir / entry.name
        if entry.is_dir():
            shutil.copytree(entry, dest, ignore=shutil.ignore_patterns("*.py", "__pycache__"))
        else:
            shutil.copy2(entry, dest)


def build_site(src_dir: Path, out_dir: Path, site_url: str) -> None:
    manifest = json.loads((src_dir / "content" / "manifest.json").read_text(encoding="utf-8"))
    template_html = (src_dir / "index.html").read_text(encoding="utf-8")

    pages: list[dict] = []
    for section in manifest["sections"]:
        for item in section["items"]:
            pages.append({
                "slug": item["slug"],
                "title": item["title"],
                "file": item["file"],
                "summary": item.get("summary", ""),
                "tags": item.get("tags", []),
                "section": section["title"],
            })

    known_slugs = {p["slug"] for p in pages}

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    copy_static_assets(src_dir, out_dir)

    for page in pages:
        rendered = render_page_html(
            template_html,
            page=page,
            pages=pages,
            manifest=manifest,
            known_slugs=known_slugs,
            src_dir=src_dir,
            site_url=site_url,
        )
        target = out_dir / "index.html" if page["slug"] == "index" else out_dir / page["slug"] / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8", newline="\n")

    (out_dir / "sitemap.xml").write_text(build_sitemap_xml(pages, src_dir, site_url), encoding="utf-8", newline="\n")
    (out_dir / "robots.txt").write_text(build_robots_txt(site_url), encoding="utf-8", newline="\n")
    (out_dir / "404.html").write_text(
        build_404_html([p["slug"] for p in pages], site_url),
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    default_src = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Build static SEO pages for Syntiox CORE docs.")
    parser.add_argument("--src", default=str(default_src), help="Source website directory")
    parser.add_argument("--out", default="_site", help="Output static site directory")
    parser.add_argument("--site-url", default=os.environ.get("SITE_URL", DEFAULT_SITE_URL), help="Public site base URL")
    args = parser.parse_args()

    site_url = normalize_site_url(args.site_url)
    build_site(Path(args.src).resolve(), Path(args.out).resolve(), site_url)
    print(f"Built static SEO site at {args.out} for {site_url}")


if __name__ == "__main__":
    main()

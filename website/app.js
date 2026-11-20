(function () {
  "use strict";

  const REPO_URL = "https://github.com/syntiox/syntioxcore";
  const RELEASE_LATEST_URL = REPO_URL + "/releases/latest";
  const RELEASE_API_URL = "https://api.github.com/repos/syntiox/syntioxcore/releases/latest";
  const BODY_DATA = document.body ? document.body.dataset : {};
  const BASE_PATH = BODY_DATA.basePath || "./";
  const INITIAL_SLUG = BODY_DATA.pageSlug || "";
  const CLEAN_URLS = BODY_DATA.cleanUrls === "true";
  const MANIFEST_URL = BASE_PATH + "content/manifest.json";

  const state = {
    manifest: null,
    pages: [],
    pageBySlug: new Map(),
    markdownCache: new Map(),
    currentSlug: "index",
    hasRendered: false,
    renderGen: 0,
    mermaidReady: false,
    fuse: null,
    indexPromise: null,
    searchItems: [],
    selectedResultIndex: -1,
    tocObserver: null
  };

  const els = {
    sidebar: document.getElementById("sidebar-nav"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    sidebarClose: document.getElementById("sidebar-close"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    navTree: document.getElementById("nav-tree"),
    docContent: document.getElementById("doc-content"),
    homeHero: document.getElementById("home-hero"),
    docHeader: document.getElementById("doc-header"),
    docSectionName: document.getElementById("doc-section-name"),
    docSourceLink: document.getElementById("doc-source-link"),
    markdownRoot: document.getElementById("markdown-root"),
    docPager: document.getElementById("doc-pager"),
    tocAside: document.getElementById("toc-aside"),
    tocList: document.getElementById("toc-list"),
    searchTrigger: document.getElementById("search-trigger"),
    searchModal: document.getElementById("search-modal"),
    searchOverlay: document.getElementById("search-overlay"),
    searchClose: document.getElementById("search-close"),
    searchInput: document.getElementById("search-input"),
    searchStatus: document.getElementById("search-status"),
    searchResults: document.getElementById("search-results")
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function slugifyHeading(text, slugCounts) {
    const clean = String(text || "")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/<[^>]*>/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section";

    const count = slugCounts.get(clean) || 0;
    slugCounts.set(clean, count + 1);
    return count === 0 ? clean : clean + "-" + count;
  }

  async function copyText(text, button) {
    if (!text) return;
    let copied = false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (_) {
        copied = false;
      }
    }

    if (!copied) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        copied = document.execCommand("copy");
      } catch (_) {
        copied = false;
      }
      document.body.removeChild(ta);
    }

    if (copied && button) {
      const prev = button.textContent;
      button.textContent = "Copied";
      button.classList.add("is-copied");
      window.setTimeout(function () {
        button.textContent = prev || "Copy";
        button.classList.remove("is-copied");
      }, 1600);
    }
  }

  function findClosingFence(src, startIdx, fenceChar, fenceLen) {
    let idx = startIdx;
    while (idx < src.length) {
      const lineEnd = src.indexOf("\n", idx);
      const end = lineEnd === -1 ? src.length : lineEnd;
      const line = src.slice(idx, end);
      const match = line.match(/^ {0,3}([`~]+)[ \t]*$/);
      if (match && match[1][0] === fenceChar && match[1].length >= fenceLen) {
        return lineEnd === -1 ? src.length : lineEnd + 1;
      }
      idx = lineEnd === -1 ? src.length : lineEnd + 1;
    }
    return src.length;
  }

  function findClosingInlineCode(src, startIdx, tickLen) {
    let i = startIdx;
    while (i < src.length) {
      if (src[i] === "\n" && src[i + 1] === "\n") {
        return -1;
      }
      if (src[i] === "`") {
        let len = 0;
        while (src[i + len] === "`") len += 1;
        if (len === tickLen) {
          return i + len;
        }
        i += len;
        continue;
      }
      i += 1;
    }
    return -1;
  }

  function findUnescapedDelim(src, startIdx, delim, singleLine) {
    let i = startIdx;
    while (i < src.length) {
      if (singleLine && src[i] === "\n") return -1;
      if (src[i] === "\\") {
        i += 2;
        continue;
      }
      if (src.startsWith(delim, i)) {
        return i;
      }
      i += 1;
    }
    return -1;
  }

  function isLineStart(src, idx) {
    let lineStart = src.lastIndexOf("\n", idx - 1) + 1;
    for (let k = lineStart; k < idx; k += 1) {
      if (src[k] !== " ") return false;
    }
    return idx - lineStart <= 3;
  }

  function getPageHref(slug, anchor) {
    const cleanAnchor = anchor ? "#" + String(anchor).replace(/^#/, "") : "";
    if (CLEAN_URLS) {
      const route = slug === "index" ? BASE_PATH : BASE_PATH + slug + "/";
      return route + cleanAnchor;
    }
    const hashRoute = slug === "index" ? "#/" : "#/" + slug;
    return hashRoute + cleanAnchor;
  }

  function parseFrontmatter(rawMarkdown) {
    const src = String(rawMarkdown || "").replace(/\r\n/g, "\n");
    const match = src.match(/^---\n([\s\S]*?)\n---(?:\n+|$)/);
    if (!match) {
      return { meta: {}, body: src };
    }
    const meta = {};
    for (const line of match[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) meta[key] = val;
    }
    return {
      meta: meta,
      body: src.slice(match[0].length)
    };
  }

  // Extract LaTeX expressions while skipping fenced and inline code spans
  function extractMathExpressions(rawMarkdown) {
    const src = String(rawMarkdown || "").replace(/\r\n/g, "\n");
    const mathList = [];
    let out = "";
    let i = 0;

    while (i < src.length) {
      if (isLineStart(src, i) && (src.startsWith("```", i) || src.startsWith("~~~", i))) {
        const ch = src[i];
        let fenceLen = 0;
        while (src[i + fenceLen] === ch) fenceLen += 1;
        const firstNewline = src.indexOf("\n", i + fenceLen);
        if (firstNewline === -1) {
          out += src.slice(i);
          break;
        }
        const closePos = findClosingFence(src, firstNewline + 1, ch, fenceLen);
        out += src.slice(i, closePos);
        i = closePos;
        continue;
      }

      if (src[i] === "`") {
        let tickLen = 0;
        while (src[i + tickLen] === "`") tickLen += 1;
        const closeCode = findClosingInlineCode(src, i + tickLen, tickLen);
        if (closeCode !== -1) {
          out += src.slice(i, closeCode);
          i = closeCode;
          continue;
        }
        out += src.slice(i, i + tickLen);
        i += tickLen;
        continue;
      }

      const escaped = i > 0 && src[i - 1] === "\\";

      if (!escaped && src.startsWith("$$", i)) {
        const end = findUnescapedDelim(src, i + 2, "$$", false);
        if (end !== -1) {
          const tex = src.slice(i + 2, end).trim();
          const id = mathList.length;
          mathList.push({ tex: tex, display: true });
          out += '<div class="katex-placeholder" data-katex-id="' + id + '" data-display="true"></div>';
          i = end + 2;
          continue;
        }
      }

      if (!escaped && src.startsWith("\\[", i)) {
        const end = findUnescapedDelim(src, i + 2, "\\]", false);
        if (end !== -1) {
          const tex = src.slice(i + 2, end).trim();
          const id = mathList.length;
          mathList.push({ tex: tex, display: true });
          out += '<div class="katex-placeholder" data-katex-id="' + id + '" data-display="true"></div>';
          i = end + 2;
          continue;
        }
      }

      if (!escaped && src.startsWith("\\(", i)) {
        const end = findUnescapedDelim(src, i + 2, "\\)", true);
        if (end !== -1) {
          const tex = src.slice(i + 2, end).trim();
          const id = mathList.length;
          mathList.push({ tex: tex, display: false });
          out += '<span class="katex-placeholder" data-katex-id="' + id + '" data-display="false"></span>';
          i = end + 2;
          continue;
        }
      }

      if (!escaped && src[i] === "$" && src[i + 1] !== "$") {
        const nextChar = src[i + 1] || "";
        if (nextChar && !/\s/.test(nextChar)) {
          const end = findUnescapedDelim(src, i + 1, "$", true);
          if (end !== -1 && end > i + 1) {
            const prevChar = src[end - 1];
            const afterChar = src[end + 1] || "";
            if (!/\s/.test(prevChar) && !/[0-9]/.test(afterChar)) {
              const tex = src.slice(i + 1, end).trim();
              const id = mathList.length;
              mathList.push({ tex: tex, display: false });
              out += '<span class="katex-placeholder" data-katex-id="' + id + '" data-display="false"></span>';
              i = end + 1;
              continue;
            }
          }
        }
      }

      out += src[i];
      i += 1;
    }

    return { markdown: out, mathList: mathList };
  }

  function renderMarkdownToHtml(rawMarkdown, currentSlug) {
    const parsed = parseFrontmatter(rawMarkdown);
    const extracted = extractMathExpressions(parsed.body);
    const slugCounts = new Map();

    if (!window.marked || typeof window.marked.Marked !== "function") {
      return {
        html: "<pre>" + escapeHtml(parsed.body) + "</pre>",
        mathList: []
      };
    }

    const md = new window.marked.Marked({
      gfm: true,
      breaks: false
    });

    md.use({
      renderer: {
        heading: function (tokenOrText, legacyLevel) {
          const depth = typeof tokenOrText === "object" ? tokenOrText.depth : legacyLevel;
          const rawText = typeof tokenOrText === "object" ? tokenOrText.text : tokenOrText;
          const id = slugifyHeading(rawText, slugCounts);
          const innerHtml = typeof tokenOrText === "object" && tokenOrText.tokens && this.parser
            ? this.parser.parseInline(tokenOrText.tokens)
            : escapeHtml(rawText);
          const anchorHref = CLEAN_URLS
            ? "#" + id
            : (currentSlug === "index" ? "#/" : "#/" + currentSlug) + "#" + id;
          return (
            "<h" + depth + ' id="' + escapeAttr(id) + '">' +
            innerHtml +
            '<a class="heading-anchor" href="' + escapeAttr(anchorHref) + '" aria-label="Link to heading">#</a>' +
            "</h" + depth + ">\n"
          );
        },
        code: function (tokenOrCode, legacyLang) {
          const rawCode = typeof tokenOrCode === "object" ? tokenOrCode.text : tokenOrCode;
          const langInfo = typeof tokenOrCode === "object" ? tokenOrCode.lang : legacyLang;
          const lang = String(langInfo || "").trim().split(/\s+/)[0].toLowerCase();

          if (lang === "mermaid") {
            return (
              '<div class="mermaid-wrap">' +
              '<div class="mermaid-label">Mermaid Diagram</div>' +
              '<div class="mermaid-canvas"><pre class="mermaid">' +
              escapeHtml(rawCode) +
              "</pre></div></div>\n"
            );
          }

          let highlighted = escapeHtml(rawCode);
          let langClass = "";
          if (lang && lang !== "text" && lang !== "plaintext" && window.hljs && window.hljs.getLanguage(lang)) {
            highlighted = window.hljs.highlight(rawCode, {
              language: lang,
              ignoreIllegals: true
            }).value;
            langClass = "language-" + escapeAttr(lang);
          }

          return (
            '<div class="code-block">' +
            '<div class="code-block-header">' +
            '<span class="code-block-lang">' + escapeHtml(lang || "text") + "</span>" +
            '<button class="code-copy-btn" type="button" aria-label="Copy code">Copy</button>' +
            "</div>" +
            '<pre><code class="hljs ' + langClass + '">' + highlighted + "</code></pre>" +
            "</div>\n"
          );
        }
      }
    });

    const parsedHtml = md.parse(extracted.markdown);
    const sanitizedHtml = window.DOMPurify
      ? window.DOMPurify.sanitize(parsedHtml, {
          ADD_TAGS: ["button"],
          ADD_ATTR: ["data-katex-id", "data-display", "aria-label", "target", "rel"],
          FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"]
        })
      : parsedHtml;

    return {
      html: sanitizedHtml,
      mathList: extracted.mathList
    };
  }

  function resolveRelativeMdHref(href, currentFile) {
    if (!href) return null;
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return null;

    const hashIdx = href.indexOf("#");
    const pathPart = hashIdx === -1 ? href : href.slice(0, hashIdx);
    const anchorPart = hashIdx === -1 ? "" : href.slice(hashIdx);
    if (!/\.md$/i.test(pathPart)) return null;

    const baseDir = currentFile.includes("/")
      ? currentFile.slice(0, currentFile.lastIndexOf("/") + 1)
      : "";
    const combined = baseDir + pathPart;
    const segments = [];
    for (const part of combined.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        segments.pop();
      } else {
        segments.push(part);
      }
    }

    const resolvedFile = segments.join("/");
    const resolvedSlug = resolvedFile.replace(/\.md$/i, "");
    if (!state.pageBySlug.has(resolvedSlug)) return null;

    return getPageHref(resolvedSlug, anchorPart);
  }

  function enhanceRenderedDom(container, currentPage, mathList) {
    // Convert GitHub alert syntax inside blockquotes
    const blockquotes = container.querySelectorAll("blockquote");
    for (const bq of blockquotes) {
      const firstP = bq.querySelector("p:first-child");
      if (!firstP || !firstP.firstChild || firstP.firstChild.nodeType !== Node.TEXT_NODE) continue;
      const text = firstP.firstChild.nodeValue || "";
      const match = text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (!match) continue;
      const kind = match[1].toLowerCase();
      firstP.firstChild.nodeValue = text.slice(match[0].length);
      const label = document.createElement("span");
      label.className = "md-alert-title";
      label.textContent = kind;
      bq.classList.add("md-alert", "md-alert-" + kind);
      bq.insertBefore(label, bq.firstChild);
    }

    // Rewrite relative .md links to hash routes and secure external links
    const links = container.querySelectorAll("a[href]");
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        continue;
      }
      const mapped = resolveRelativeMdHref(href, currentPage.file);
      if (mapped) {
        link.setAttribute("href", mapped);
      }
    }

    // Render KaTeX formulas into sanitized placeholder nodes
    if (window.katex && mathList.length > 0) {
      const placeholders = container.querySelectorAll(".katex-placeholder[data-katex-id]");
      for (const node of placeholders) {
        const idx = Number(node.getAttribute("data-katex-id"));
        const entry = mathList[idx];
        if (!entry) continue;
        window.katex.render(entry.tex, node, {
          displayMode: entry.display,
          throwOnError: false,
          strict: false,
          trust: false
        });
      }
    }

    // Attach copy handlers to rendered code blocks
    const copyButtons = container.querySelectorAll(".code-copy-btn");
    for (const btn of copyButtons) {
      btn.addEventListener("click", function () {
        const block = btn.closest(".code-block");
        const codeEl = block ? block.querySelector("pre > code") : null;
        if (codeEl) {
          copyText(codeEl.textContent || "", btn);
        }
      });
    }
  }

  function getMermaidNaturalWidth(svg) {
    if (!svg) return 0;
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/);
      if (parts.length >= 4) {
        const w = parseFloat(parts[2]);
        if (w > 0) return w;
      }
    }
    const rawW = parseFloat(svg.getAttribute("width") || "");
    return rawW > 0 ? rawW : 0;
  }

  function closeMermaidLightbox() {
    const lightbox = document.getElementById("mermaid-lightbox");
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    const body = lightbox.querySelector(".mermaid-lightbox-body");
    if (body) body.innerHTML = "";
  }

  function openMermaidLightbox(svgEl) {
    if (!svgEl) return;
    let lightbox = document.getElementById("mermaid-lightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "mermaid-lightbox";
      lightbox.className = "mermaid-lightbox";
      lightbox.setAttribute("role", "dialog");
      lightbox.setAttribute("aria-modal", "true");
      lightbox.setAttribute("aria-label", "Expanded diagram");
      lightbox.hidden = true;

      const dialog = document.createElement("div");
      dialog.className = "mermaid-lightbox-dialog";

      const header = document.createElement("div");
      header.className = "mermaid-lightbox-header";

      const title = document.createElement("span");
      title.className = "mermaid-lightbox-title";
      title.textContent = "Mermaid Diagram";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "esc-btn";
      closeBtn.setAttribute("aria-label", "Close diagram");
      closeBtn.textContent = "Esc";
      closeBtn.addEventListener("click", closeMermaidLightbox);

      const body = document.createElement("div");
      body.className = "mermaid-lightbox-body";

      header.appendChild(title);
      header.appendChild(closeBtn);
      dialog.appendChild(header);
      dialog.appendChild(body);
      lightbox.appendChild(dialog);

      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeMermaidLightbox();
      });

      document.body.appendChild(lightbox);
    }

    const body = lightbox.querySelector(".mermaid-lightbox-body");
    if (!body) return;
    body.innerHTML = "";

    const clone = svgEl.cloneNode(true);
    const natW = getMermaidNaturalWidth(clone);
    if (clone.getAttribute("viewBox")) {
      clone.removeAttribute("height");
    }
    if (natW > 0) {
      clone.style.width = Math.max(Math.ceil(natW), 880) + "px";
      clone.style.minWidth = Math.min(Math.ceil(natW), 760) + "px";
      clone.style.maxWidth = natW > 1160 ? "none" : "100%";
      clone.style.height = "auto";
    }
    body.appendChild(clone);
    lightbox.hidden = false;
  }

  async function renderMermaidDiagrams(container, gen) {
    if (!window.mermaid) return;
    const nodes = container.querySelectorAll("pre.mermaid");
    if (nodes.length === 0) return;

    if (!state.mermaidReady) {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: "basis"
        },
        sequence: {
          useMaxWidth: false,
          actorFontSize: 14,
          messageFontSize: 14,
          noteFontSize: 13,
          actorMargin: 50,
          boxMargin: 10,
          messageMargin: 36
        },
        themeVariables: {
          darkMode: true,
          background: "#0c0d10",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "15px",
          primaryColor: "#181920",
          primaryTextColor: "#f4f4f5",
          primaryBorderColor: "#383c4c",
          lineColor: "#00ccff",
          secondaryColor: "#121318",
          tertiaryColor: "#20222b",
          textColor: "#f4f4f5",
          actorBkg: "#181920",
          actorBorder: "#383c4c",
          actorTextColor: "#f4f4f5",
          actorLineColor: "#52586e",
          signalColor: "#00ccff",
          signalTextColor: "#f4f4f5",
          labelBoxBkgColor: "#14161e",
          labelBoxBorderColor: "#383c4c",
          labelTextColor: "#f4f4f5",
          loopTextColor: "#e4e4e7",
          noteBkgColor: "#181920",
          noteTextColor: "#f4f4f5",
          noteBorderColor: "#00ccff"
        }
      });
      state.mermaidReady = true;
    }

    for (let idx = 0; idx < nodes.length; idx += 1) {
      if (gen !== state.renderGen) return;
      const pre = nodes[idx];
      const source = (pre.textContent || "").trim();
      if (!source) continue;

      try {
        const result = await window.mermaid.render("syntiox-diagram-" + gen + "-" + idx, source);
        if (gen !== state.renderGen) return;
        const holder = document.createElement("div");
        holder.className = "mermaid-diagram";
        holder.innerHTML = result.svg;
        if (typeof result.bindFunctions === "function") {
          result.bindFunctions(holder);
        }

        const svg = holder.querySelector("svg");
        const natW = getMermaidNaturalWidth(svg);
        if (svg && natW > 0) {
          if (svg.getAttribute("viewBox")) {
            svg.removeAttribute("height");
          }
          svg.style.width = "100%";
          svg.style.maxWidth = Math.ceil(natW) + "px";
          svg.style.minWidth = Math.min(Math.ceil(natW), 680) + "px";
          svg.style.height = "auto";
        }

        const wrap = pre.closest(".mermaid-wrap");
        const label = wrap ? wrap.querySelector(".mermaid-label") : null;
        if (svg && label && !label.querySelector(".mermaid-expand-btn")) {
          const textSpan = document.createElement("span");
          textSpan.textContent = label.textContent || "Mermaid Diagram";
          label.textContent = "";
          label.appendChild(textSpan);

          const expandBtn = document.createElement("button");
          expandBtn.type = "button";
          expandBtn.className = "mermaid-expand-btn";
          expandBtn.textContent = "Expand";
          expandBtn.addEventListener("click", function () {
            openMermaidLightbox(svg);
          });
          label.appendChild(expandBtn);
        }

        pre.replaceWith(holder);
      } catch (_) {
        // Keep readable diagram source block on parse errors
      }
    }
  }

  function buildSidebarNav() {
    els.navTree.innerHTML = "";
    for (const section of state.manifest.sections) {
      const group = document.createElement("div");
      group.className = "nav-group";

      const title = document.createElement("h3");
      title.className = "nav-group-title";
      title.textContent = section.title;
      group.appendChild(title);

      const list = document.createElement("ul");
      list.className = "nav-group-list";

      for (const item of section.items) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "nav-item-link";
        a.href = getPageHref(item.slug);
        a.dataset.slug = item.slug;
        a.textContent = item.title;
        a.addEventListener("click", function () {
          closeMobileSidebar();
        });
        li.appendChild(a);
        list.appendChild(li);
      }

      group.appendChild(list);
      els.navTree.appendChild(group);
    }
  }

  function updateSidebarActive(slug) {
    const links = els.navTree.querySelectorAll(".nav-item-link");
    for (const link of links) {
      link.classList.toggle("is-active", link.dataset.slug === slug);
    }
  }

  function buildTableOfContents(slug) {
    if (state.tocObserver) {
      state.tocObserver.disconnect();
      state.tocObserver = null;
    }

    els.tocList.innerHTML = "";
    const headings = Array.from(els.markdownRoot.querySelectorAll("h2[id], h3[id]"));
    if (headings.length === 0) {
      els.tocAside.style.visibility = "hidden";
      return;
    }

    els.tocAside.style.visibility = "visible";
    const routePrefix = slug === "index" ? "#/" : "#/" + slug;
    const tocLinksById = new Map();

    for (const h of headings) {
      const a = document.createElement("a");
      a.className = "toc-link" + (h.tagName === "H3" ? " is-sub" : "");
      a.href = CLEAN_URLS ? "#" + h.id : routePrefix + "#" + h.id;
      const clone = h.cloneNode(true);
      const anchorSpan = clone.querySelector(".heading-anchor");
      if (anchorSpan) anchorSpan.remove();
      a.textContent = (clone.textContent || "").trim();
      els.tocList.appendChild(a);
      tocLinksById.set(h.id, a);
    }

    if (typeof IntersectionObserver !== "function") return;

    state.tocObserver = new IntersectionObserver(
      function (entries) {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const link of tocLinksById.values()) {
            link.classList.remove("is-active");
          }
          const active = tocLinksById.get(entry.target.id);
          if (active) active.classList.add("is-active");
          break;
        }
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 }
    );

    for (const h of headings) {
      state.tocObserver.observe(h);
    }
  }

  function updatePager(slug) {
    els.docPager.innerHTML = "";
    const idx = state.pages.findIndex(function (p) {
      return p.slug === slug;
    });
    if (idx === -1) return;

    const prev = idx > 0 ? state.pages[idx - 1] : null;
    const next = idx < state.pages.length - 1 ? state.pages[idx + 1] : null;

    if (prev) {
      const a = document.createElement("a");
      a.className = "pager-card is-prev";
      a.href = getPageHref(prev.slug);
      const dir = document.createElement("span");
      dir.className = "pager-dir";
      dir.textContent = "Previous";
      const title = document.createElement("span");
      title.className = "pager-title";
      title.textContent = prev.title;
      a.appendChild(dir);
      a.appendChild(title);
      els.docPager.appendChild(a);
    }

    if (next) {
      const a = document.createElement("a");
      a.className = "pager-card is-next";
      a.href = getPageHref(next.slug);
      const dir = document.createElement("span");
      dir.className = "pager-dir";
      dir.textContent = "Next";
      const title = document.createElement("span");
      title.className = "pager-title";
      title.textContent = next.title;
      a.appendChild(dir);
      a.appendChild(title);
      els.docPager.appendChild(a);
    }
  }

  function parseRouteFromHash() {
    const rawHash = window.location.hash || "";
    if (CLEAN_URLS) {
      const initial = state.pageBySlug.has(INITIAL_SLUG) ? INITIAL_SLUG : "index";
      if (rawHash.startsWith("#/")) {
        const stripped = rawHash.replace(/^#\/?/, "");
        const anchorIdx = stripped.indexOf("#");
        const pathPart = (anchorIdx === -1 ? stripped : stripped.slice(0, anchorIdx)).replace(/\.md$/i, "").replace(/\/+$/, "");
        const anchorPart = anchorIdx === -1 ? "" : stripped.slice(anchorIdx + 1);
        const targetSlug = state.pageBySlug.has(pathPart || "index") ? (pathPart || "index") : "index";
        if (targetSlug !== initial) {
          window.location.replace(getPageHref(targetSlug, anchorPart));
          return null;
        }
        const cleanUrl = anchorPart
          ? "#" + anchorPart
          : window.location.pathname + window.location.search;
        if (window.history && typeof window.history.replaceState === "function") {
          window.history.replaceState(null, "", cleanUrl);
        }
        return { slug: targetSlug, anchor: anchorPart };
      }
      return {
        slug: initial,
        anchor: rawHash.replace(/^#/, "")
      };
    }

    const raw = rawHash || "#/";
    const stripped = raw.replace(/^#\/?/, "");
    const anchorIdx = stripped.indexOf("#");
    const pathPart = (anchorIdx === -1 ? stripped : stripped.slice(0, anchorIdx)).replace(/\.md$/i, "").replace(/\/+$/, "");
    const anchorPart = anchorIdx === -1 ? "" : stripped.slice(anchorIdx + 1);
    const slug = pathPart || "index";
    return {
      slug: state.pageBySlug.has(slug) ? slug : "index",
      anchor: anchorPart
    };
  }

  async function fetchMarkdown(file) {
    if (state.markdownCache.has(file)) {
      return state.markdownCache.get(file);
    }
    const res = await fetch(BASE_PATH + "content/" + file);
    if (!res.ok) {
      throw new Error("Failed to load " + file + " (" + res.status + ")");
    }
    const text = await res.text();
    state.markdownCache.set(file, text);
    return text;
  }

  async function renderRoute() {
    if (!state.manifest) return;

    const route = parseRouteFromHash();
    if (!route) return;
    const page = state.pageBySlug.get(route.slug);
    if (!page) return;

    if (state.hasRendered && state.currentSlug === page.slug) {
      if (route.anchor) {
        const target = document.getElementById(route.anchor);
        if (target) target.scrollIntoView();
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return;
    }

    const gen = ++state.renderGen;
    state.currentSlug = page.slug;
    state.hasRendered = false;
    updateSidebarActive(page.slug);

    const isHome = page.slug === "index";
    els.homeHero.hidden = !isHome;
    els.docHeader.hidden = isHome;

    if (!isHome) {
      els.docSectionName.textContent = page.section;
      els.docSourceLink.href = REPO_URL + "/blob/master/website/content/" + page.file;
    }

    document.title = isHome
      ? "Syntiox CORE — Local AI Agent OS for Windows"
      : page.title + " — Syntiox CORE";

    try {
      const mdText = await fetchMarkdown(page.file);
      if (gen !== state.renderGen) return;

      const parsed = parseFrontmatter(mdText);
      const pageTitle = parsed.meta.title || page.title;
      const pageDesc = parsed.meta.description || page.summary || "";

      document.title = isHome
        ? "Syntiox CORE — Local AI Agent OS for Windows"
        : pageTitle + " — Syntiox CORE";

      if (pageDesc) {
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) descMeta.setAttribute("content", pageDesc);
      }

      const rendered = renderMarkdownToHtml(mdText, page.slug);
      els.markdownRoot.innerHTML = rendered.html;
      enhanceRenderedDom(els.markdownRoot, page, rendered.mathList);
      buildTableOfContents(page.slug);
      updatePager(page.slug);
      state.hasRendered = true;
      await renderMermaidDiagrams(els.markdownRoot, gen);

      if (gen !== state.renderGen) return;

      if (route.anchor) {
        const target = document.getElementById(route.anchor);
        if (target) {
          target.scrollIntoView();
          return;
        }
      }
      if (!CLEAN_URLS) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    } catch (err) {
      if (gen !== state.renderGen) return;
      if (CLEAN_URLS && els.markdownRoot && !els.markdownRoot.querySelector(".loading-state") && els.markdownRoot.textContent.trim()) {
        return;
      }
      const errBox = document.createElement("div");
      errBox.className = "error-state";
      errBox.textContent = err.message;
      els.markdownRoot.innerHTML = "";
      els.markdownRoot.appendChild(errBox);
    }
  }

  // Strip markdown syntax for Fuse.js search indexing
  function stripMarkdownForSearch(mdText) {
    const body = parseFrontmatter(mdText).body;
    const headings = [];
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^#{1,4}\s+(.+)/);
      if (m) headings.push(m[1].replace(/`/g, "").trim());
    }

    const plain = body
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[#>*\-\d.\s]+/gm, " ")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      headingsText: headings.join(" · "),
      body: plain
    };
  }

  async function buildSearchIndex() {
    if (state.fuse) return state.fuse;
    if (state.indexPromise) return state.indexPromise;

    state.indexPromise = (async function () {
      const records = await Promise.all(
        state.pages.map(async function (page) {
          let raw = "";
          try {
            raw = await fetchMarkdown(page.file);
          } catch (_) {
            raw = page.summary || "";
          }
          const stripped = stripMarkdownForSearch(raw);
          return {
            slug: page.slug,
            title: page.title,
            section: page.section,
            summary: page.summary || "",
            tags: (page.tags || []).join(" "),
            headingsText: stripped.headingsText,
            body: stripped.body
          };
        })
      );

      if (typeof window.Fuse === "function") {
        state.fuse = new window.Fuse(records, {
          keys: [
            { name: "title", weight: 0.35 },
            { name: "headingsText", weight: 0.25 },
            { name: "tags", weight: 0.15 },
            { name: "summary", weight: 0.15 },
            { name: "body", weight: 0.10 }
          ],
          includeMatches: true,
          threshold: 0.35,
          ignoreLocation: true,
          minMatchCharLength: 2
        });
      }
      return state.fuse;
    })();

    return state.indexPromise;
  }

  function appendHighlightedText(parent, text, indices) {
    if (!indices || indices.length === 0) {
      parent.appendChild(document.createTextNode(text));
      return;
    }

    let cursor = 0;
    for (const pair of indices) {
      const start = pair[0];
      const end = pair[1] + 1;
      if (start > cursor) {
        parent.appendChild(document.createTextNode(text.slice(cursor, start)));
      }
      const mark = document.createElement("mark");
      mark.textContent = text.slice(start, end);
      parent.appendChild(mark);
      cursor = end;
    }

    if (cursor < text.length) {
      parent.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  function buildMatchedSnippet(result) {
    const item = result.item;
    const matches = result.matches || [];
    const bodyMatch = matches.find(function (m) {
      return m.key === "body" || m.key === "headingsText" || m.key === "summary";
    });

    if (!bodyMatch || !bodyMatch.indices || bodyMatch.indices.length === 0) {
      const span = document.createElement("span");
      span.className = "search-result-snippet";
      span.textContent = item.summary || item.body.slice(0, 140);
      return span;
    }

    const fullText = bodyMatch.value || "";
    const firstStart = bodyMatch.indices[0][0];
    const sliceStart = Math.max(0, firstStart - 45);
    const sliceEnd = Math.min(fullText.length, sliceStart + 160);
    const slice = fullText.slice(sliceStart, sliceEnd);

    const adjustedIndices = [];
    for (const pair of bodyMatch.indices) {
      const s = pair[0] - sliceStart;
      const e = pair[1] - sliceStart;
      if (e >= 0 && s < slice.length) {
        adjustedIndices.push([Math.max(0, s), Math.min(slice.length - 1, e)]);
      }
    }

    const span = document.createElement("span");
    span.className = "search-result-snippet";
    if (sliceStart > 0) span.appendChild(document.createTextNode("..."));
    appendHighlightedText(span, slice, adjustedIndices);
    if (sliceEnd < fullText.length) span.appendChild(document.createTextNode("..."));
    return span;
  }

  function renderSearchResults(query) {
    els.searchResults.innerHTML = "";
    state.selectedResultIndex = -1;

    const trimmed = query.trim();
    if (!trimmed) {
      els.searchStatus.textContent = "Browse all sections or type at least 2 characters to search.";
      state.searchItems = state.pages.slice(0, 8);
      for (let i = 0; i < state.searchItems.length; i += 1) {
        appendSearchItemNode(state.searchItems[i], null, i);
      }
      updateSelectedResult(0);
      return;
    }

    if (!state.fuse) {
      els.searchStatus.textContent = "Search index is loading...";
      return;
    }

    const hits = state.fuse.search(trimmed, { limit: 10 });
    state.searchItems = hits.map(function (h) {
      return h.item;
    });

    if (hits.length === 0) {
      els.searchStatus.textContent = "No matching pages found.";
      const li = document.createElement("li");
      li.className = "search-empty";
      li.textContent = 'No documentation matches "' + trimmed + '".';
      els.searchResults.appendChild(li);
      return;
    }

    els.searchStatus.textContent = hits.length + (hits.length === 1 ? " result" : " results");
    for (let i = 0; i < hits.length; i += 1) {
      appendSearchItemNode(hits[i].item, hits[i], i);
    }
    updateSelectedResult(0);
  }

  function appendSearchItemNode(item, fuseHit, index) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result-btn";
    btn.dataset.index = String(index);

    const top = document.createElement("div");
    top.className = "search-result-top";

    const title = document.createElement("span");
    title.className = "search-result-title";
    const titleMatch = fuseHit && fuseHit.matches
      ? fuseHit.matches.find(function (m) { return m.key === "title"; })
      : null;
    if (titleMatch) {
      appendHighlightedText(title, item.title, titleMatch.indices);
    } else {
      title.textContent = item.title;
    }

    const sectionBadge = document.createElement("span");
    sectionBadge.className = "search-result-section";
    sectionBadge.textContent = item.section;

    top.appendChild(title);
    top.appendChild(sectionBadge);
    btn.appendChild(top);

    if (fuseHit) {
      btn.appendChild(buildMatchedSnippet(fuseHit));
    } else {
      const summary = document.createElement("span");
      summary.className = "search-result-snippet";
      summary.textContent = item.summary || "";
      btn.appendChild(summary);
    }

    btn.addEventListener("click", function () {
      navigateToSearchItem(item);
    });

    li.appendChild(btn);
    els.searchResults.appendChild(li);
  }

  function updateSelectedResult(nextIdx) {
    const buttons = els.searchResults.querySelectorAll(".search-result-btn");
    if (buttons.length === 0) {
      state.selectedResultIndex = -1;
      return;
    }
    const clamped = (nextIdx + buttons.length) % buttons.length;
    state.selectedResultIndex = clamped;
    for (let i = 0; i < buttons.length; i += 1) {
      const selected = i === clamped;
      buttons[i].classList.toggle("is-selected", selected);
      if (selected) {
        buttons[i].scrollIntoView({ block: "nearest" });
      }
    }
  }

  function navigateToSearchItem(item) {
    closeSearchModal();
    if (CLEAN_URLS) {
      window.location.href = getPageHref(item.slug);
    } else {
      window.location.hash = item.slug === "index" ? "#/" : "#/" + item.slug;
    }
  }

  async function openSearchModal() {
    els.searchModal.hidden = false;
    els.searchInput.value = "";
    els.searchInput.focus();
    renderSearchResults("");

    if (!state.fuse) {
      els.searchStatus.textContent = "Indexing markdown documentation...";
      await buildSearchIndex();
      if (!els.searchModal.hidden) {
        renderSearchResults(els.searchInput.value);
      }
    }
  }

  function closeSearchModal() {
    if (els.searchModal.hidden) return;
    els.searchModal.hidden = true;
  }

  function openMobileSidebar() {
    els.sidebar.classList.add("is-open");
    els.sidebarBackdrop.hidden = false;
    els.sidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeMobileSidebar() {
    els.sidebar.classList.remove("is-open");
    els.sidebarBackdrop.hidden = true;
    els.sidebarToggle.setAttribute("aria-expanded", "false");
  }

  async function fetchLatestReleaseMeta() {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? window.setTimeout(function () { ctrl.abort(); }, 5000) : null;

    try {
      const res = await fetch(RELEASE_API_URL, {
        headers: { Accept: "application/vnd.github+json" },
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) return;
      const rel = await res.json();

      if (rel && typeof rel.tag_name === "string" && rel.tag_name.trim()) {
        const tag = rel.tag_name.trim();
        for (const el of document.querySelectorAll("[data-release-tag]")) {
          el.textContent = tag;
        }
      }

      if (rel && Array.isArray(rel.assets)) {
        const setupAsset = rel.assets.find(function (a) {
          return (
            a &&
            typeof a.name === "string" &&
            /^Syntiox-CORE-Setup-.*\.exe$/i.test(a.name) &&
            typeof a.browser_download_url === "string" &&
            a.browser_download_url.startsWith(REPO_URL + "/")
          );
        });
        if (setupAsset) {
          for (const link of document.querySelectorAll("[data-release-link]")) {
            link.href = setupAsset.browser_download_url;
          }
        }
      }
    } catch (_) {
      // Static fallback links remain active if offline or rate-limited
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  function setupGlobalEvents() {
    window.addEventListener("hashchange", function () {
      renderRoute();
    });

    for (const btn of document.querySelectorAll("[data-copy-target]")) {
      btn.addEventListener("click", function () {
        const target = document.getElementById(btn.dataset.copyTarget);
        if (target) copyText(target.textContent || "", btn);
      });
    }

    els.sidebarToggle.addEventListener("click", openMobileSidebar);
    els.sidebarClose.addEventListener("click", closeMobileSidebar);
    els.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

    els.searchTrigger.addEventListener("click", openSearchModal);
    els.searchOverlay.addEventListener("click", closeSearchModal);
    els.searchClose.addEventListener("click", closeSearchModal);

    els.searchInput.addEventListener("input", function () {
      renderSearchResults(els.searchInput.value);
    });

    els.searchInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        updateSelectedResult(state.selectedResultIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        updateSelectedResult(state.selectedResultIndex - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = state.searchItems[state.selectedResultIndex];
        if (chosen) navigateToSearchItem(chosen);
      } else if (e.key === "Escape") {
        closeSearchModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (els.searchModal.hidden) {
          openSearchModal();
        } else {
          closeSearchModal();
        }
        return;
      }

      if (e.key === "/" && els.searchModal.hidden) {
        const tag = document.activeElement ? document.activeElement.tagName : "";
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          openSearchModal();
        }
        return;
      }

      if (e.key === "Escape") {
        const lightbox = document.getElementById("mermaid-lightbox");
        if (lightbox && !lightbox.hidden) {
          closeMermaidLightbox();
        } else if (!els.searchModal.hidden) {
          closeSearchModal();
        } else if (els.sidebar.classList.contains("is-open")) {
          closeMobileSidebar();
        }
      }
    });

    // Ensure fallback href stays explicit in case DOM needs reset
    for (const link of document.querySelectorAll("[data-release-link]")) {
      if (!link.getAttribute("href")) {
        link.setAttribute("href", RELEASE_LATEST_URL);
      }
    }
  }

  async function init() {
    setupGlobalEvents();
    fetchLatestReleaseMeta();

    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) {
        throw new Error("Could not load manifest (" + res.status + ")");
      }
      const manifest = await res.json();
      state.manifest = manifest;

      for (const section of manifest.sections) {
        for (const item of section.items) {
          const entry = {
            slug: item.slug,
            title: item.title,
            file: item.file,
            summary: item.summary || "",
            tags: item.tags || [],
            section: section.title
          };
          state.pages.push(entry);
          state.pageBySlug.set(entry.slug, entry);
        }
      }

      buildSidebarNav();
      await renderRoute();
      buildSearchIndex();
    } catch (err) {
      if (CLEAN_URLS && els.markdownRoot && !els.markdownRoot.querySelector(".loading-state") && els.markdownRoot.textContent.trim()) {
        return;
      }
      const notice = document.createElement("div");
      notice.className = "local-notice";
      const title = document.createElement("strong");
      title.textContent = "Unable to load Markdown files directly.";
      const body = document.createElement("p");
      body.textContent =
        window.location.protocol === "file:"
          ? "Browsers block fetch() on file:// URLs. Serve the website folder over HTTP (for example: python -m http.server 8080 inside website/) or open the deployed GitHub Pages site."
          : err.message;
      notice.appendChild(title);
      notice.appendChild(body);
      els.markdownRoot.innerHTML = "";
      els.markdownRoot.appendChild(notice);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

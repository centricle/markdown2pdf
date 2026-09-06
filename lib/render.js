/*
 * Markdown in, complete HTML document out.
 *
 * Nothing here touches a browser. Keeping the render step pure makes it
 * testable without launching Chrome, which is most of what the test suite
 * needs.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

const escapeHtml = MarkdownIt().utils.escapeHtml;

/*
 * Code blocks get highlight.js class names rather than inline styles, so a
 * theme owns code coloring the same way it owns everything else. A theme with
 * no `.hljs-*` rules simply renders code unhighlighted, which is a reasonable
 * look rather than a broken one.
 */
function highlight(code, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const { value } = hljs.highlight(code, { language: lang, ignoreIllegals: true });
      return `<pre class="hljs"><code class="language-${escapeHtml(lang)}">${value}</code></pre>`;
    } catch {
      /* Fall through to the unhighlighted form. */
    }
  }
  return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
}

export function createRenderer() {
  return new MarkdownIt({ html: true, linkify: true, typographer: true, highlight })
    .use(anchor, { permalink: false })
    .use(attrs)
    .use(footnote);
}

/** Markdown source to an HTML fragment. */
export function renderBody(markdown) {
  return createRenderer().render(markdown);
}

/**
 * First ATX heading in the source, used as the document title. Only affects
 * PDF metadata, so a miss costs nothing.
 */
function firstHeading(markdown) {
  const match = markdown.match(/^#{1,6}\s+(.+?)\s*$/m);
  return match ? match[1].replace(/[*_`]/g, '') : null;
}

/**
 * Assemble the printable document.
 *
 * `baseDir` is the directory the markdown came from. It becomes a `<base
 * href>` so relative image paths in the source resolve, which matters because
 * the HTML itself is written to a temp directory somewhere else entirely.
 */
export function renderDocument({ markdown, css, baseDir, title }) {
  const base = pathToFileURL(join(resolve(baseDir), '/')).href;
  const documentTitle = title || firstHeading(markdown) || 'Document';
  const baseCss = readFileSync(join(LIB_DIR, 'base.css'), 'utf8');

  /*
   * Order matters and is load-bearing. base.css declares its rules inside
   * `@layer base`; the theme is appended unlayered. Unlayered styles beat
   * layered ones in the cascade regardless of specificity, so a theme can
   * override anything in the base without selector escalation.
   */
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="${escapeHtml(base)}">
<title>${escapeHtml(documentTitle)}</title>
<style>
${baseCss}
</style>
<style>
${css}
</style>
</head>
<body>
<main class="markdown-body">
${renderBody(markdown)}
</main>
</body>
</html>
`;
}

/*
 * HTML to PDF.
 *
 * Two rules carried over from an earlier print harness: wait for fonts before
 * printing, and let the stylesheet own the page geometry via
 * `preferCSSPageSize` rather than restating margins in flags where the two can
 * disagree.
 *
 * A static-site build would need a throwaway HTTP server here, because its
 * pages carry absolute asset paths. This does not, because the document is
 * assembled here and can carry a `<base href>` instead. A temp file plus
 * `file://` keeps relative images working with no server at all.
 *
 * `page.setContent()` is deliberately not used: its `about:blank` origin cannot
 * load `file://` subresources, so every local image in the markdown would
 * silently vanish.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { launchBrowser } from './browser.js';

const FOOTER = `<div style="width:100%;margin:0 0.75in;font:9px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#57606a;text-align:center;">
<span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`;

/* Chromium prints its own default header unless it is given an empty one. */
const EMPTY_HEADER = '<div></div>';

/**
 * @param {{html: string, pageNumbers?: boolean}} options
 * @returns {Promise<Buffer>}
 */
export async function htmlToPdf({ html, pageNumbers = false }) {
  /*
   * The document is rendered with scripts disabled and without
   * `--allow-file-access-from-files`. Markdown may carry raw HTML, so a
   * document from an untrusted source could otherwise run a script that reads
   * files next to the temp HTML (or, with that flag, anywhere on disk) and
   * posts them to a remote host. Images still load: Chromium permits a file://
   * page to fetch file:// subresources by default, which is all a PDF needs.
   * `page.evaluate` below is driven by Playwright, not the page, so it still
   * runs with page scripts off.
   */
  const { browser } = await launchBrowser();
  const dir = mkdtempSync(join(tmpdir(), 'markdown2pdf-'));
  const file = join(dir, 'document.html');

  try {
    writeFileSync(file, html);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: pageNumbers,
      ...(pageNumbers ? { headerTemplate: EMPTY_HEADER, footerTemplate: FOOTER } : {}),
    });
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

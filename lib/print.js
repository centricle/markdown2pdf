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
   * Chromium restricts file:// pages from reading sibling files in some
   * configurations. The document only ever loads images this way, which is
   * normally permitted, but the flag costs nothing and removes a failure mode
   * that presents as an image silently missing from the output.
   */
  const { browser } = await launchBrowser({ args: ['--allow-file-access-from-files'] });
  const dir = mkdtempSync(join(tmpdir(), 'markdown2pdf-'));
  const file = join(dir, 'document.html');

  try {
    writeFileSync(file, html);
    const page = await browser.newPage();
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

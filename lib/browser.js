/*
 * Getting a browser without making the user download one.
 *
 * Most markdown-to-PDF packages depend on puppeteer, which pulls its own
 * Chromium on install and costs the user roughly 150MB for a tool they may run
 * twice. This depends on playwright-core, which ships no browser at all, and
 * then goes looking for one that already exists.
 */

import { chromium } from 'playwright-core';

const ATTEMPTS = [
  { label: 'system Chrome', options: { channel: 'chrome' } },
  { label: 'a Playwright-managed Chromium', options: {} },
];

export class NoBrowserError extends Error {}

/**
 * Launch the first browser that works.
 *
 * @returns {Promise<{browser: import('playwright-core').Browser, label: string}>}
 */
export async function launchBrowser({ args = [] } = {}) {
  const failures = [];
  for (const attempt of ATTEMPTS) {
    try {
      const browser = await chromium.launch({ ...attempt.options, args });
      return { browser, label: attempt.label };
    } catch (error) {
      failures.push(`${attempt.label}: ${error.message.split('\n')[0]}`);
    }
  }
  throw new NoBrowserError(
    `No usable browser found.\n${failures.map((f) => `  - ${f}`).join('\n')}\n\n` +
      'Install Google Chrome, or run:\n  npx playwright install chromium',
  );
}

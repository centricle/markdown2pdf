/*
 * Shared test plumbing.
 *
 * On reading text back out of a generated PDF: a sibling project has a helper
 * that inflates content streams and decodes hex `Tj` operands. It does not work
 * here. That helper reads pdf-lib output, where the hex maps to a standard
 * encoding; Chromium embeds subset fonts whose hex codes are glyph indices with
 * no meaning outside the file. Poppler knows how to walk the font's ToUnicode
 * map, so `pdftotext` is the tool.
 *
 * Poppler is therefore a test-only convenience, never a runtime dependency, and
 * every check that needs it is skipped rather than failed where it is absent.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = join(ROOT, 'bin', 'markdown2pdf.js');
export const FIXTURES = join(ROOT, 'test', 'fixtures');

function onPath(command) {
  return spawnSync('which', [command], { encoding: 'utf8' }).status === 0;
}

export const HAS_POPPLER = onPath('pdftotext');

/** A throwaway directory, cleaned up by the operating system. */
export function tempDir() {
  return mkdtempSync(join(tmpdir(), 'markdown2pdf-test-'));
}

/** Run the CLI. Never throws; the caller asserts on status and output. */
export function run(args, { env = {}, cwd = ROOT, input } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    ...(input === undefined ? {} : { input }),
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function pdfText(path) {
  return execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
}

export function pdfImageCount(path) {
  const out = execFileSync('pdfimages', ['-list', path], { encoding: 'utf8' });
  return out
    .split('\n')
    .filter((line) => /^\s*\d+\s+\d+\s+image\s/.test(line))
    .length;
}

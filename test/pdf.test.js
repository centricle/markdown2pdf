/*
 * End-to-end: markdown on disk to a PDF on disk, through a real browser.
 *
 * These need a Chrome or Chromium to exist, and the text assertions need
 * poppler. Both are skipped rather than failed when absent, so a machine
 * without them still gets a meaningful test run from the other two files.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { launchBrowser } from '../lib/browser.js';
import { FIXTURES, HAS_POPPLER, pdfImageCount, pdfText, run, tempDir } from './helpers.js';

const SAMPLE = join(FIXTURES, 'sample.md');

const hasBrowser = await launchBrowser()
  .then(({ browser }) => browser.close().then(() => true))
  .catch(() => false);

const skipBrowser = hasBrowser ? false : 'no Chrome or Chromium available';
const skipText = !hasBrowser
  ? 'no Chrome or Chromium available'
  : !HAS_POPPLER
    ? 'poppler (pdftotext) not installed'
    : false;

test('produces a PDF', { skip: skipBrowser }, () => {
  const out = join(tempDir(), 'out.pdf');
  const result = run([SAMPLE, '-o', out]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /theme: github/);
  assert.equal(readFileSync(out).subarray(0, 5).toString(), '%PDF-');
});

test('the output path defaults to the input basename', { skip: skipBrowser }, () => {
  const dir = tempDir();
  const input = join(dir, 'notes.md');
  writeFileSync(input, '# Notes\n\nBody.\n');
  const result = run([input]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(dir, 'notes.pdf')).subarray(0, 5).toString(), '%PDF-');
});

test('reads markdown from stdin', { skip: skipBrowser }, () => {
  const dir = tempDir();
  const out = join(dir, 'piped.pdf');
  const result = run(['-', '-o', out], { cwd: dir, input: '# Piped\n\nBody.\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(out).subarray(0, 5).toString(), '%PDF-');
});

test('document text survives the round trip', { skip: skipText }, () => {
  const out = join(tempDir(), 'out.pdf');
  assert.equal(run([SAMPLE, '-o', out]).status, 0);
  const text = pdfText(out);

  assert.match(text, /Coyote Procurement Review/);
  assert.match(text, /Instant Tunnel Paint/, 'table cells');
  assert.match(text, /rocket-sled/, 'fenced code contents');
  assert.match(text, /settled within thirty days/, 'footnote body');
});

/*
 * The one that justifies the temp-file-plus-<base> approach in lib/print.js.
 * A regression here means every local image silently vanishes from the output,
 * which no text assertion would catch.
 */
test('a relative image is embedded', { skip: skipText }, () => {
  const out = join(tempDir(), 'out.pdf');
  assert.equal(run([SAMPLE, '-o', out]).status, 0);
  assert.ok(pdfImageCount(out) >= 1, 'expected the fixture image in the PDF');
});

/*
 * Raw HTML is allowed through, so a script in the source must not run. If it
 * did, a hostile document could read local files and post them elsewhere.
 */
test('scripts and file frames in the source do nothing', { skip: skipText }, () => {
  const dir = tempDir();
  const input = join(dir, 'hostile.md');
  const secret = join(dir, 'secret.txt');
  const out = join(dir, 'hostile.pdf');
  writeFileSync(secret, 'CONTENTS OF A LOCAL FILE\n');
  writeFileSync(
    input,
    '# Static heading\n\n' +
      '<script>document.querySelector("h1").textContent = "Mutated by script";</script>\n\n' +
      `<iframe src="file://${secret}" width="400" height="200"></iframe>\n`,
  );
  assert.equal(run([input, '-o', out]).status, 0);
  const text = pdfText(out);
  assert.match(text, /Static heading/);
  assert.doesNotMatch(text, /Mutated by script/);
  assert.doesNotMatch(text, /CONTENTS OF A LOCAL FILE/);
});

test('--page-numbers prints a footer', { skip: skipText }, () => {
  const dir = tempDir();
  const plain = join(dir, 'plain.pdf');
  const numbered = join(dir, 'numbered.pdf');

  assert.equal(run([SAMPLE, '-o', plain]).status, 0);
  assert.equal(run([SAMPLE, '--page-numbers', '-o', numbered]).status, 0);

  assert.doesNotMatch(pdfText(plain), /\d+\s*\/\s*\d+\s*$/m);
  assert.match(pdfText(numbered), /\d+\s*\/\s*\d+/);
});

test('every built-in theme renders', { skip: skipText }, () => {
  const dir = tempDir();
  for (const theme of ['github', 'manuscript', 'modern']) {
    const out = join(dir, `${theme}.pdf`);
    const result = run([SAMPLE, '-t', theme, '-o', out]);
    assert.equal(result.status, 0, `${theme}: ${result.stderr}`);
    assert.match(pdfText(out), /Coyote Procurement Review/, theme);
  }
});

test('an empty document is rejected before a browser is launched', () => {
  const dir = tempDir();
  const input = join(dir, 'empty.md');
  writeFileSync(input, '   \n');
  const result = run([input]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /is empty/);
});

test('an output path equal to the input is refused', () => {
  const dir = tempDir();
  const input = join(dir, 'notes.pdf');
  writeFileSync(input, '# Not really a PDF\n');
  for (const args of [[input], [input, '-o', input]]) {
    const result = run(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /overwrite the input/);
  }
  assert.equal(readFileSync(input, 'utf8'), '# Not really a PDF\n');
});

test('a missing input file is reported by name', () => {
  const result = run([join(tempDir(), 'nope.md')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No such file/);
});

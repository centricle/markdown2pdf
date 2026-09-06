/*
 * Render tests. No browser, no filesystem beyond the fixtures, so these run
 * anywhere and cover most of what can actually break.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { renderBody, renderDocument } from '../lib/render.js';
import { FIXTURES } from './helpers.js';

const sample = readFileSync(join(FIXTURES, 'sample.md'), 'utf8');

test('headings become heading elements with ids', () => {
  const html = renderBody('# Coyote Procurement Review\n');
  assert.match(html, /<h1[^>]*>Coyote Procurement Review<\/h1>/);
  assert.match(html, /id="coyote-procurement-review"/);
});

test('lists and tables survive', () => {
  const html = renderBody(sample);
  assert.match(html, /<ol>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<table>/);
  assert.match(html, /<td>Undelivered<\/td>/);
});

test('fenced code is highlighted with class names, not inline styles', () => {
  const html = renderBody('```js\nconst x = 1;\n```\n');
  assert.match(html, /<pre class="hljs">/);
  assert.match(html, /class="hljs-keyword"/);
  assert.doesNotMatch(html, /style="/);
});

test('an unknown language still renders, escaped', () => {
  const html = renderBody('```nosuchlang\n<script>alert(1)</script>\n```\n');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('footnotes render a reference and a body', () => {
  const html = renderBody(sample);
  assert.match(html, /footnote-ref/);
  assert.match(html, /class="footnotes"/);
  assert.match(html, /settled within thirty days/);
});

test('base href points at the source directory so relative images resolve', () => {
  const html = renderDocument({ markdown: sample, css: '', baseDir: FIXTURES });
  assert.match(html, /<base href="file:\/\/[^"]*\/test\/fixtures\/">/);
  assert.match(html, /src="red\.png"/);
});

test('title comes from the first heading', () => {
  const html = renderDocument({ markdown: sample, css: '', baseDir: FIXTURES });
  assert.match(html, /<title>Coyote Procurement Review<\/title>/);
});

test('an explicit title wins, and markup in a heading is stripped', () => {
  const explicit = renderDocument({ markdown: sample, css: '', baseDir: FIXTURES, title: 'Filed' });
  assert.match(explicit, /<title>Filed<\/title>/);

  const styled = renderDocument({ markdown: '# **Bold** Title\n', css: '', baseDir: FIXTURES });
  assert.match(styled, /<title>Bold Title<\/title>/);
});

test('the theme is emitted after the base layer so it wins the cascade', () => {
  const html = renderDocument({ markdown: '# x\n', css: 'body { color: red; }', baseDir: FIXTURES });
  assert.ok(
    html.indexOf('@layer base') < html.indexOf('body { color: red; }'),
    'base layer must precede the theme',
  );
  assert.doesNotMatch(html, /@layer theme/, 'the theme stays unlayered on purpose');
});

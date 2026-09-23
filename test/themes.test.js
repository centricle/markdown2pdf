/*
 * Theme resolution. Every test points MARKDOWN2PDF_THEMES_DIR at a throwaway
 * directory, so nothing here can read or write the real ~/.config.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { run, tempDir } from './helpers.js';

/* Imported fresh per test because the module reads the environment on call. */
async function themes(dir) {
  process.env.MARKDOWN2PDF_THEMES_DIR = dir;
  return import('../lib/themes.js');
}

test('with no user directory, the built-in github is the default', async () => {
  const { resolveTheme } = await themes(join(tempDir(), 'absent'));
  const theme = resolveTheme(undefined);
  assert.equal(theme.name, 'github');
  assert.equal(theme.source, 'builtin');
});

test('a missing user directory is not an error', async () => {
  const { listThemes } = await themes(join(tempDir(), 'absent'));
  const { builtin, user } = listThemes();
  assert.ok(builtin.length >= 3);
  assert.deepEqual(user, []);
});

test('a user default.css beats the built-in fallback', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'default.css'), 'body { color: teal; }');
  const { resolveTheme } = await themes(dir);
  const theme = resolveTheme(undefined);
  assert.equal(theme.name, 'default');
  assert.equal(theme.source, 'user');
  assert.match(theme.why, /default\.css/);
});

test('a user theme shadows a built-in of the same name', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'github.css'), 'body { color: rebeccapurple; }');
  const { resolveTheme, listThemes } = await themes(dir);
  const theme = resolveTheme('github');
  assert.equal(theme.source, 'user');
  assert.match(readFileSync(theme.path, 'utf8'), /rebeccapurple/);
  assert.equal(listThemes().user[0].shadows, true);
});

test('an unknown theme names the ones that exist', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'mine.css'), 'body {}');
  const { resolveTheme } = await themes(dir);
  assert.throws(() => resolveTheme('nope'), (error) => {
    assert.match(error.message, /Unknown theme "nope"/);
    assert.match(error.message, /github/);
    assert.match(error.message, /mine/);
    return true;
  });
});

test('a value that looks like a path is treated as one', async () => {
  const dir = tempDir();
  const path = join(dir, 'loose.css');
  writeFileSync(path, 'body {}');
  const { resolveTheme } = await themes(tempDir());
  assert.equal(resolveTheme(path).source, 'path');
  assert.throws(() => resolveTheme(join(dir, 'gone.css')), /No stylesheet at/);
});

test('init seeds the built-ins and never overwrites an existing file', async () => {
  const dir = join(tempDir(), 'nested', 'themes');
  const { initThemes } = await themes(dir);

  const first = initThemes();
  assert.equal(first.created, true);
  assert.ok(first.copied.includes('github'));
  assert.ok(existsSync(join(dir, 'github.css')));

  writeFileSync(join(dir, 'github.css'), '/* mine */');
  const second = initThemes();
  assert.deepEqual(second.copied, []);
  assert.ok(second.skipped.includes('github'));
  assert.equal(readFileSync(join(dir, 'github.css'), 'utf8'), '/* mine */');
});

test('XDG_CONFIG_HOME is honored, under a centricle vendor directory', async () => {
  const { userThemesDir } = await import('../lib/themes.js');
  const xdg = tempDir();
  delete process.env.MARKDOWN2PDF_THEMES_DIR;
  process.env.XDG_CONFIG_HOME = xdg;
  try {
    assert.equal(userThemesDir(), join(xdg, 'centricle', 'markdown2pdf', 'themes'));
  } finally {
    delete process.env.XDG_CONFIG_HOME;
  }
});

test('the CLI reports which default is active and why', () => {
  const dir = tempDir();
  mkdirSync(dir, { recursive: true });

  const before = run(['--list-themes'], { env: { MARKDOWN2PDF_THEMES_DIR: dir } });
  assert.equal(before.status, 0);
  assert.match(before.stdout, /Default with no --theme: github\s+\(built-in fallback\)/);

  writeFileSync(join(dir, 'default.css'), 'body {}');
  const after = run(['--list-themes'], { env: { MARKDOWN2PDF_THEMES_DIR: dir } });
  assert.match(after.stdout, /Default with no --theme: default/);
});

test('a theme containing </style is rejected', async () => {
  const dir = tempDir();
  const path = join(dir, 'escape.css');
  writeFileSync(path, 'body {}\n</style><script>alert(1)</script><style>');
  const { readTheme, resolveTheme } = await themes(tempDir());
  assert.throws(() => readTheme(resolveTheme(path)), /<\/style/);

  const result = run(['test/fixtures/sample.md', '-t', path, '-o', join(dir, 'out.pdf')], {
    env: { MARKDOWN2PDF_THEMES_DIR: tempDir() },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /<\/style/);
  assert.ok(!existsSync(join(dir, 'out.pdf')));
});

test('the CLI exits nonzero on an unknown theme', () => {
  const result = run(['test/fixtures/sample.md', '-t', 'nope'], {
    env: { MARKDOWN2PDF_THEMES_DIR: tempDir() },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown theme "nope"/);
});

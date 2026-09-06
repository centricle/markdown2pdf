/*
 * Theme discovery and resolution.
 *
 * Two directories are in play: the built-ins that ship inside the package, and
 * a user directory that shadows them by name. Nothing is ever created at
 * install time — see initThemes() for why the config directory only appears
 * when someone explicitly asks for it.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Themes that ship inside the package. */
export const BUILTIN_DIR = join(PKG_ROOT, 'themes');

/** Used when the user has no default.css of their own. */
export const FALLBACK_THEME = 'github';

/**
 * The name a user theme takes to become the default. Reserved so that dropping
 * a `default.css` into the themes directory does the obvious thing without
 * anyone having to read the documentation first.
 */
export const RESERVED_DEFAULT = 'default';

/**
 * Where a user's own themes live.
 *
 * The `centricle/` segment is not decoration. An unrelated `markdown2pdf`
 * already exists on npm, so a bare `~/.config/markdown2pdf/` could collide with
 * a different tool's configuration. Nesting under a vendor directory also means
 * any sibling tool lands beside this one instead of adding another top-level
 * entry.
 */
export function userThemesDir() {
  const override = process.env.MARKDOWN2PDF_THEMES_DIR;
  if (override) return resolve(override);
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'centricle', 'markdown2pdf', 'themes');
}

function readDir(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ name: basename(f, '.css'), path: join(dir, f) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Built-in and user themes, with user entries flagged where they shadow. */
export function listThemes() {
  const builtin = readDir(BUILTIN_DIR);
  const user = readDir(userThemesDir());
  const builtinNames = new Set(builtin.map((t) => t.name));
  return {
    builtin,
    user: user.map((t) => ({ ...t, shadows: builtinNames.has(t.name) })),
    userDir: userThemesDir(),
  };
}

function looksLikePath(value) {
  return value.includes('/') || value.includes('\\') || value.endsWith('.css');
}

class ThemeError extends Error {}

/**
 * Resolve a `--theme` value to a stylesheet.
 *
 * Order: literal path, then the user directory, then the built-ins. With no
 * value, a user `default.css` wins and the built-in fallback is used otherwise.
 *
 * @returns {{name: string, path: string, source: string, why: string}}
 */
export function resolveTheme(value) {
  const userDir = userThemesDir();

  if (value) {
    if (looksLikePath(value)) {
      const path = resolve(value);
      if (!existsSync(path)) throw new ThemeError(`No stylesheet at ${path}`);
      return { name: basename(path, '.css'), path, source: 'path', why: 'given as a path' };
    }
    const userPath = join(userDir, `${value}.css`);
    if (existsSync(userPath)) {
      return { name: value, path: userPath, source: 'user', why: `--theme ${value}` };
    }
    const builtinPath = join(BUILTIN_DIR, `${value}.css`);
    if (existsSync(builtinPath)) {
      return { name: value, path: builtinPath, source: 'builtin', why: `--theme ${value}` };
    }
    const { builtin, user } = listThemes();
    const known = [...new Set([...user.map((t) => t.name), ...builtin.map((t) => t.name)])].sort();
    throw new ThemeError(`Unknown theme "${value}". Available: ${known.join(', ')}`);
  }

  const userDefault = join(userDir, `${RESERVED_DEFAULT}.css`);
  if (existsSync(userDefault)) {
    return {
      name: RESERVED_DEFAULT,
      path: userDefault,
      source: 'user',
      why: `${RESERVED_DEFAULT}.css in ${userDir}`,
    };
  }

  return {
    name: FALLBACK_THEME,
    path: join(BUILTIN_DIR, `${FALLBACK_THEME}.css`),
    source: 'builtin',
    why: 'built-in fallback',
  };
}

export function readTheme(theme) {
  return readFileSync(theme.path, 'utf8');
}

/**
 * Create the user themes directory and seed it with copies of the built-ins.
 *
 * This is a command, never a `postinstall`. An install script that writes to a
 * home directory does not run under `npx`, is skipped by `--ignore-scripts`,
 * breaks in CI and sandboxes, and is exactly the npm behavior people have
 * learned to distrust.
 *
 * Existing files are never overwritten.
 */
export function initThemes() {
  const dir = userThemesDir();
  const created = !existsSync(dir);
  mkdirSync(dir, { recursive: true });
  const copied = [];
  const skipped = [];
  for (const theme of readDir(BUILTIN_DIR)) {
    const target = join(dir, `${theme.name}.css`);
    if (existsSync(target)) {
      skipped.push(theme.name);
      continue;
    }
    copyFileSync(theme.path, target);
    copied.push(theme.name);
  }
  return { dir, created, copied, skipped };
}

export { ThemeError };

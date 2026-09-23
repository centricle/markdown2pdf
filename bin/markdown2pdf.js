#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { htmlToPdf } from '../lib/print.js';
import { renderDocument } from '../lib/render.js';
import {
  FALLBACK_THEME,
  RESERVED_DEFAULT,
  ThemeError,
  initThemes,
  listThemes,
  readTheme,
  resolveTheme,
} from '../lib/themes.js';

const HELP = `markdown2pdf — Markdown to PDF, styled with plain CSS.

Usage
  markdown2pdf <input.md> [options]
  markdown2pdf - [options]          read markdown from stdin

Options
  -o, --output <path>     output file (default: input basename + .pdf)
  -t, --theme <name|path> theme name, or a path to a .css file
      --page-numbers      print "N / total" in the footer
      --list-themes       show available themes and which default is active
      --init-themes       create the user themes directory, seeded with copies
  -h, --help              this text
  -v, --version           package version

Themes
  A theme is one CSS file. Built-ins ship with the package; your own live in
  the directory --list-themes reports and shadow built-ins of the same name.
  A theme named "${RESERVED_DEFAULT}" there becomes the default, otherwise the
  built-in "${FALLBACK_THEME}" is used.
`;

function version() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.version;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function readStdin() {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function printThemes() {
  const { builtin, user, userDir } = listThemes();
  const active = resolveTheme(undefined);

  console.log('Built-in:');
  for (const theme of builtin) {
    const shadowed = user.some((u) => u.name === theme.name);
    console.log(`  ${theme.name}${shadowed ? '  (shadowed by your copy)' : ''}`);
  }

  console.log(`\nYours (${userDir}):`);
  if (user.length === 0) {
    console.log('  none yet — markdown2pdf --init-themes creates it');
  } else {
    for (const theme of user) {
      console.log(`  ${theme.name}${theme.shadows ? '  (shadows a built-in)' : ''}`);
    }
  }

  console.log(`\nDefault with no --theme: ${active.name}  (${active.why})`);
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      theme: { type: 'string', short: 't' },
      'page-numbers': { type: 'boolean', default: false },
      'list-themes': { type: 'boolean', default: false },
      'init-themes': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });
} catch (error) {
  fail(`${error.message}\n\nmarkdown2pdf --help`);
}

const { values, positionals } = parsed;

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

if (values.version) {
  console.log(version());
  process.exit(0);
}

if (values['init-themes']) {
  const { dir, created, copied, skipped } = initThemes();
  console.log(`${created ? 'Created' : 'Using'} ${dir}`);
  if (copied.length) console.log(`Seeded: ${copied.join(', ')}`);
  if (skipped.length) console.log(`Left alone: ${skipped.join(', ')}`);
  console.log(`\nA theme named "${RESERVED_DEFAULT}" here becomes the default.`);
  process.exit(0);
}

if (values['list-themes']) {
  printThemes();
  process.exit(0);
}

if (positionals.length === 0) {
  fail('No input file.\n\nmarkdown2pdf --help');
}
if (positionals.length > 1) {
  fail(`Expected one input file, got ${positionals.length}: ${positionals.join(', ')}`);
}

const input = positionals[0];
const fromStdin = input === '-';

let markdown;
let baseDir;
if (fromStdin) {
  markdown = await readStdin();
  baseDir = process.cwd();
} else {
  const path = resolve(input);
  try {
    markdown = readFileSync(path, 'utf8');
  } catch (error) {
    fail(error.code === 'ENOENT' ? `No such file: ${input}` : error.message);
  }
  baseDir = dirname(path);
}

if (!markdown.trim()) {
  fail(fromStdin ? 'Nothing on stdin.' : `${input} is empty.`);
}

let theme;
try {
  theme = resolveTheme(values.theme);
} catch (error) {
  fail(error instanceof ThemeError ? error.message : String(error));
}

const output = values.output
  ? resolve(values.output)
  : fromStdin
    ? join(process.cwd(), 'document.pdf')
    : join(dirname(resolve(input)), `${basename(input, extname(input))}.pdf`);

/* `markdown2pdf notes.pdf` would otherwise replace the input with its output. */
if (!fromStdin && output === resolve(input)) {
  fail(`Output would overwrite the input: ${input}`);
}

try {
  const html = renderDocument({ markdown, css: readTheme(theme), baseDir });
  const pdf = await htmlToPdf({ html, pageNumbers: values['page-numbers'] });
  writeFileSync(output, pdf);
  console.log(`${output}  ${(pdf.length / 1024).toFixed(1)}KB  theme: ${theme.name}`);
} catch (error) {
  fail(error.message);
}

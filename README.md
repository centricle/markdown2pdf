# markdown2pdf

Markdown in, PDF out. Styled with plain CSS, printed with the Chrome you already
have.

```
npx @centricle/markdown2pdf notes.md
```

## Install

```
npm install -g @centricle/markdown2pdf
```

Or run it without installing, with `npx @centricle/markdown2pdf`. To work from
a checkout instead:

```
git clone https://github.com/centricle/markdown2pdf.git
cd markdown2pdf && npm install && npm link
```

## Why another one

There are plenty of these. Three things are different here.

**No browser download.** This depends on `playwright-core`, which ships no
browser at all, and then looks for one already on your machine: system Chrome
first, then any Chromium a previous Playwright install left behind. Most
alternatives depend on puppeteer and cost you roughly 150MB for a tool you might
run twice.

**Themes are just CSS files.** No template language, no config schema, no
plugin API. One file, the selectors you already know. Your own themes live in a
directory beside the built-in ones and override them by name.

**Nothing is created when you install it.** No `postinstall` writing to your
home directory. The config directory appears when you ask for it and not before.

## Usage

```
markdown2pdf <input.md> [options]
markdown2pdf - [options]          read markdown from stdin

  -o, --output <path>     output file (default: input basename + .pdf)
  -t, --theme <name|path> theme name, or a path to a .css file
      --page-numbers      print "N / total" in the footer
      --list-themes       show available themes and which default is active
      --init-themes       create the user themes directory, seeded with copies
  -h, --help
  -v, --version
```

Relative image paths in the markdown resolve against the file's own directory,
so `![](diagram.png)` works the way it does everywhere else.

## Themes

Three ship with the package:

| Theme | For |
| --- | --- |
| `github` | A printable take on GitHub's rendered README. The default. |
| `manuscript` | Serif book setting. Something to be read end to end. |
| `modern` | Sans, tight, strong heading contrast. Something to be skimmed. |

To write your own, start from a copy:

```
markdown2pdf --init-themes      # seeds ~/.config/centricle/markdown2pdf/themes
markdown2pdf --list-themes      # shows the path and the active default
```

A file in that directory shadows a built-in of the same name. A file named
`default.css` becomes the default for every run with no `--theme`.

You can also point straight at a stylesheet anywhere:

```
markdown2pdf report.md -t ./house-style.css
```

### Writing one

A theme is an ordinary stylesheet applied to the rendered markdown. Two things
are worth knowing.

The tool's own base styles are wrapped in `@layer base`, and your theme is
loaded unlayered. Unlayered CSS beats layered CSS in the cascade no matter how
specific either selector is, so `body { font-family: Georgia; }` is enough. You
never have to escalate a selector to win.

Page geometry comes from your `@page` rule, because the PDF is generated with
`preferCSSPageSize`:

```css
@page {
  size: a4;
  margin: 2cm;
}
```

Code blocks are marked up with highlight.js class names, so `.hljs-keyword`,
`.hljs-string` and friends are yours to color. A theme with no `.hljs-*` rules
renders code unhighlighted, which looks deliberate rather than broken.

## Requirements

Node 20 or newer, and a Chrome or Chromium somewhere on the machine. If you have
neither, the error says so and tells you the one command that fixes it:

```
npx playwright install chromium
```

## Security

Raw HTML in the markdown passes through to the document. To keep that from
being a problem, the page is rendered with scripts disabled, frames and
plugin elements (`iframe`, `object`, `embed`, `meta`) are stripped, and
Chromium's file-access flag is not used. A `<script>` in the source does
nothing, and an `<iframe src="file:///...">` cannot paste a local file into
the output. What remains is that remote images are fetched at render time, so
a document can tell a remote host that it was rendered, and when. Treat input
from a stranger accordingly.

## Development

```
npm test
```

The render and theme tests need nothing beyond Node. The end-to-end tests need
a browser, and their text assertions additionally need poppler's `pdftotext`.
Both are skipped rather than failed where they are missing.

Bugs and ideas: [github.com/centricle/markdown2pdf/issues](https://github.com/centricle/markdown2pdf/issues).

## License

MIT

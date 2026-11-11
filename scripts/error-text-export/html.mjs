import { COLUMNS, statusCounts } from './rows.mjs'

// The export as one self-contained web page: its styles and script inline, so
// it opens from a CI artifact or an email with nothing else to fetch. A
// search box hides the rows that do not hold what is typed.

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function escape(value) {
  return String(value ?? '').replaceAll(/[&<>"']/g, (char) => ESCAPES[char])
}

const LINE_ANCHOR = /#L(\d+)$/

function sourceCell(value) {
  const links = String(value ?? '')
    .split('\n')
    .filter(Boolean)
    .map((url) => {
      const line = LINE_ANCHOR.exec(url)?.[1]
      const text = line ? `Line ${line}` : url
      return `<a href="${escape(url)}">${escape(text)}</a>`
    })
  return links.join('<br>')
}

function cell(row, key) {
  return key === 'source' ? sourceCell(row[key]) : escape(row[key])
}

const STYLE = `
:root {
  color-scheme: light;
  --bg: #ffffff; --ink: #0b0c0c; --muted: #505a5f; --rule: #b1b4b6;
  --head: #f3f2f1; --link: #1d70b8; --mark: #fff7bf;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #161819; --ink: #e8e8e8; --muted: #a6adb1; --rule: #3d4245;
    --head: #222527; --link: #8bb8e8; --mark: #4a4415;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px 16px; background: var(--bg); color: var(--ink);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
}
h1 { margin: 0 0 4px; font-size: 1.6rem; }
p { margin: 0 0 12px; color: var(--muted); }
a { color: var(--link); }
label { display: block; font-weight: 600; margin: 16px 0 4px; }
input[type="search"] {
  width: 100%; max-width: 480px; padding: 6px 8px; font: inherit;
  color: inherit; background: var(--bg); border: 2px solid var(--ink);
}
.table-scroll { overflow: auto; max-height: 80vh; border: 1px solid var(--rule); margin-top: 12px; }
table { border-collapse: collapse; font-size: 0.85rem; }
th, td {
  text-align: left; vertical-align: top; padding: 6px 8px;
  border-bottom: 1px solid var(--rule); white-space: pre-line;
  min-width: 12rem; max-width: 32rem;
}
th { position: sticky; top: 0; background: var(--head); z-index: 1; }
th:first-child, td:first-child {
  position: sticky; left: 0; background: var(--head); z-index: 2;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  /* Wide enough for most IDs, but never most of a phone's screen. */
  min-width: min(14rem, 40vw); max-width: min(18rem, 40vw);
  overflow-wrap: anywhere;
}
th:first-child { z-index: 3; }
tr[hidden] { display: none; }
`

// Hides each row whose text does not hold every word typed, ignoring case.
const SCRIPT = `
const search = document.getElementById('search')
const rows = [...document.querySelectorAll('tbody tr')]
const shown = document.getElementById('shown')
search.addEventListener('input', () => {
  const words = search.value.toLowerCase().split(/\\s+/).filter(Boolean)
  let count = 0
  for (const row of rows) {
    const text = row.textContent.toLowerCase()
    const match = words.every((word) => text.includes(word))
    row.hidden = !match
    count += match ? 1 : 0
  }
  shown.textContent = String(count)
})
`

/**
 * @param {Array<Record<string, string>>} rows - from buildRows
 * @param {{ date: string, branch: string, commit: string, commitUrl: string }} meta
 * @param {typeof COLUMNS} [columns]
 * @returns {string}
 */
export function toHtml(rows, meta, columns = COLUMNS) {
  const counts = Object.entries(statusCounts(rows))
    .map(([status, count]) => `${count} ${escape(status)}`)
    .join(', ')
  const head = columns
    .map(({ header }) => `<th scope="col">${escape(header)}</th>`)
    .join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map(({ key }) => `<td>${cell(row, key)}</td>`).join('')}</tr>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Error messages</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Error messages</h1>
<p>Every message in error-text.yaml, generated ${escape(meta.date)} from branch ${escape(meta.branch)}, commit <a href="${escape(meta.commitUrl)}">${escape(meta.commit.slice(0, 7))}</a>. ${rows.length} error IDs: ${counts}.</p>
<label for="search">Search</label>
<input type="search" id="search" autocomplete="off">
<p>Showing <span id="shown">${rows.length}</span> of ${rows.length}</p>
<div class="table-scroll">
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`
}

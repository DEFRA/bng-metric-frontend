import { COLUMNS, WORDING_KEYS, buildRows } from './rows.mjs'

// What a change to error-text.yaml does to the export, for a pull request's
// run summary: the error IDs it adds and removes, the parts of each message
// it changes, and the statuses it moves. No I/O: it compares two lists of
// rows from buildRows, matched by error ID.

/** The columns compared: where an error is shown, and every part of it. */
const COMPARED_KEYS = Object.freeze(['shown', ...WORDING_KEYS, 'fallback'])

const HEADERS = Object.fromEntries(
  COLUMNS.map(({ key, header }) => [key, header])
)

/**
 * What changed between two exports.
 *
 * @param {Array<Record<string, string>>} before - rows from buildRows
 * @param {Array<Record<string, string>>} after - rows from buildRows
 * @returns {{
 *   added: Array<Record<string, string>>,
 *   removed: Array<Record<string, string>>,
 *   changed: Array<{ ids: string[], parts: Array<{ part: string, before: string, after: string }> }>,
 *   statuses: Array<{ id: string, before: string, after: string }>
 * }}
 */
export function diffRows(before, after) {
  const was = new Map(before.map((row) => [row.id, row]))
  const now = new Map(after.map((row) => [row.id, row]))
  const kept = after.filter((row) => was.has(row.id))

  return {
    added: after.filter((row) => !was.has(row.id)),
    removed: before.filter((row) => !now.has(row.id)),
    changed: groupChanges(kept, was),
    statuses: kept
      .filter((row) => row.status !== was.get(row.id).status)
      .map((row) => ({
        id: row.id,
        before: was.get(row.id).status,
        after: row.status
      }))
  }
}

/**
 * Each kept row's changed parts. Rows with the same changes share one entry:
 * rewording a shared fallback changes every error that shows it alike.
 */
function groupChanges(kept, was) {
  const groups = new Map()
  for (const row of kept) {
    const old = was.get(row.id)
    const parts = COMPARED_KEYS.filter((key) => old[key] !== row[key]).map(
      (key) => ({ part: HEADERS[key], before: old[key], after: row[key] })
    )
    if (parts.length > 0) {
      const key = JSON.stringify(parts)
      const group = groups.get(key) ?? { ids: [], parts }
      group.ids.push(row.id)
      groups.set(key, group)
    }
  }
  return [...groups.values()]
}

/** True when the diff holds no change at all. */
export function isEmptyDiff({ added, removed, changed, statuses }) {
  return [added, removed, changed, statuses].every((list) => list.length === 0)
}

// Markdown would read a link, an emphasis or a table edge into the wording.
const MARKDOWN_SPECIAL = /[\\`*_[\]<>|]/g

/** Text as one table cell: its own characters, its line breaks kept. */
function cell(text) {
  return text
    ? String(text).replaceAll(MARKDOWN_SPECIAL, '\\$&').replaceAll('\n', '<br>')
    : '_(none)_'
}

function code(id) {
  return `\`${id}\``
}

function rowTable(rows) {
  return [
    '| Error ID | Where it is shown | Status |',
    '| --- | --- | --- |',
    ...rows.map(
      (row) => `| ${code(row.id)} | ${cell(row.shown)} | ${row.status} |`
    )
  ]
}

function changedSection(changed) {
  return changed.flatMap(({ ids, parts }) => [
    `**${ids.map(code).join(', ')}**`,
    '',
    '| Part | Before | After |',
    '| --- | --- | --- |',
    ...parts.map(
      ({ part, before, after }) =>
        `| ${part} | ${cell(before)} | ${cell(after)} |`
    ),
    ''
  ])
}

function statusTable(statuses) {
  return [
    '| Error ID | Before | After |',
    '| --- | --- | --- |',
    ...statuses.map(
      ({ id, before, after }) => `| ${code(id)} | ${before} | ${after} |`
    )
  ]
}

function section(title, list, lines) {
  return list.length > 0
    ? [`#### ${title} (${list.length})`, '', ...lines, '']
    : []
}

/**
 * The diff as Markdown, for a run summary.
 *
 * @param {ReturnType<typeof diffRows>} diff
 * @param {string} base - what the rows before came from, as Markdown
 * @returns {string}
 */
export function diffMarkdown(diff, base) {
  const heading = [`### Wording changes from ${base}`, '']
  if (isEmptyDiff(diff)) {
    return [...heading, 'No wording changes.', ''].join('\n')
  }
  return [
    ...heading,
    ...section('Added', diff.added, rowTable(diff.added)),
    ...section('Removed', diff.removed, rowTable(diff.removed)),
    ...section(
      'Changed',
      diff.changed.flatMap(({ ids }) => ids),
      changedSection(diff.changed)
    ),
    ...section('Status changed', diff.statuses, statusTable(diff.statuses))
  ].join('\n')
}

/**
 * Said in place of the changes when they cannot be worked out, so the run
 * still keeps the export.
 *
 * @param {string} base - the base, as Markdown
 * @param {string} reason
 */
export function notCompared(base, reason) {
  return `### Wording changes from ${base}\n\nThe changes are not shown: ${cell(reason)}\n`
}

/**
 * What a change makes of the export, against error-text.yaml as it was at
 * the base: said, rather than thrown, when that file is missing or cannot be
 * compared, so the run still keeps the export.
 *
 * @param {Array<Record<string, string>>} rows - rows from buildRows, after
 * @param {string | null} baseSource - error-text.yaml's text at the base, or
 *   null when the base has no such file
 * @param {string} base - the base, as Markdown
 * @returns {string}
 */
export function compareWithBase(rows, baseSource, base) {
  if (baseSource === null) {
    return notCompared(base, 'error-text.yaml is not on the base commit.')
  }
  try {
    return diffMarkdown(diffRows(buildRows(baseSource), rows), base)
  } catch (error) {
    return notCompared(
      base,
      `the base commit's error-text.yaml could not be compared: ${error.message}`
    )
  }
}

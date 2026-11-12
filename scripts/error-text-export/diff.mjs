import {
  COLUMNS,
  DEFAULT_GROUPS,
  SHARED_KEYS,
  STATUS,
  STATUS_ORDER,
  WORDING_KEYS,
  buildRows
} from './rows.mjs'

// What a change to error-text.yaml does to the export, for a pull request's
// run or a push to main's: the error IDs it adds and removes, with their words, the parts of each
// message it changes, and the statuses it moves. Each is given as Markdown,
// for the run's summary, and as plain text, for its log, where it shows
// without opening the summary. No I/O: it compares two lists of rows from
// buildRows, matched by error ID.

/** The columns compared: where an error is shown, and every part of it. */
const COMPARED_KEYS = Object.freeze(['shown', ...WORDING_KEYS, ...SHARED_KEYS])

/** The parts of a message an added or removed error is shown with. */
const MESSAGE_KEYS = Object.freeze([...WORDING_KEYS, ...SHARED_KEYS])

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

/**
 * The changes that leave wording unfinished: an error added that is not
 * Final, and one whose status moves back, as from Final to Awaiting UCD. A
 * pull request or a merge is warned of these, and of nothing that was
 * unfinished before it.
 *
 * @param {ReturnType<typeof diffRows>} diff
 * @param {Array<Record<string, string>>} after - rows from buildRows, after
 * @returns {Array<{ row: Record<string, string>, before?: string }>}
 */
export function unfinishedChanges({ added, statuses }, after) {
  const rowOf = new Map(after.map((row) => [row.id, row]))
  const rank = (status) => STATUS_ORDER.indexOf(status)
  return [
    ...added
      .filter((row) => row.status !== STATUS.FINAL)
      .map((row) => ({ row })),
    ...statuses
      .filter(({ before, after: now }) => rank(now) < rank(before))
      .map(({ id, before }) => ({ row: rowOf.get(id), before }))
  ]
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

/** An added or removed row's parts that have words, as [header, text]. */
function messageParts(row) {
  return MESSAGE_KEYS.filter((key) => row[key]).map((key) => [
    HEADERS[key],
    row[key]
  ])
}

// --- Markdown, for the run summary ---

function rowsMarkdown(rows) {
  return rows.flatMap((row) => [
    `**${code(row.id)}**: ${cell(row.shown)}, ${row.status}`,
    '',
    '| Part | Words |',
    '| --- | --- |',
    ...messageParts(row).map(([part, text]) => `| ${part} | ${cell(text)} |`),
    ''
  ])
}

function changedMarkdown(changed) {
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

function statusesMarkdown(statuses) {
  return [
    '| Error ID | Before | After |',
    '| --- | --- | --- |',
    ...statuses.map(
      ({ id, before, after }) => `| ${code(id)} | ${before} | ${after} |`
    ),
    ''
  ]
}

function sectionMarkdown(title, count, lines) {
  return count > 0 ? [`#### ${title} (${count})`, '', ...lines] : []
}

// --- Plain text, for the run's log ---

const INDENT = '    '

/**
 * Text under a label, each of its lines indented alike. A part with no words
 * is '' in a row, and says "(none)", as `cell` does in the summary.
 */
function indented(text, depth) {
  const pad = INDENT.repeat(depth)
  return String(text || '(none)')
    .split('\n')
    .map((line) => `${pad}${line}`)
}

function rowsText(rows) {
  return rows.flatMap((row) => [
    `  ${row.id} (${row.shown}, ${row.status})`,
    ...messageParts(row).flatMap(([part, text]) => [
      `${INDENT}${part}:`,
      ...indented(text, 2)
    ])
  ])
}

function changedText(changed) {
  return changed.flatMap(({ ids, parts }) => [
    // One ID a line: a reworded fallback can change a score of them alike.
    ...ids.map((id) => `  ${id}`),
    ...parts.flatMap(({ part, before, after }) => [
      `${INDENT}${part}, before:`,
      ...indented(before, 2),
      `${INDENT}${part}, after:`,
      ...indented(after, 2)
    ])
  ])
}

function statusesText(statuses) {
  return statuses.map(
    ({ id, before, after }) => `  ${id}: ${before} -> ${after}`
  )
}

function sectionText(title, count, lines) {
  return count > 0 ? ['', `${title} (${count})`, ...lines] : []
}

// --- Both ---

/**
 * What the changes are of, and from where, as a heading: "Wording changes in
 * codes from abc1234". The groups are named, as a group left out of the
 * export is left out of the comparison too: a "none" is only for them.
 */
function headings(base, groups) {
  const scope = `Wording changes in ${groups.join(', ')}`
  return {
    markdown: `### ${scope} from ${base.markdown}`,
    text: `${scope} from ${base.text}`
  }
}

/**
 * The diff as Markdown, for a run summary, and as plain text, for its log.
 *
 * @param {ReturnType<typeof diffRows>} diff
 * @param {{ markdown: string, text: string }} base - what the rows before
 *   came from: a link, and its plain name
 * @param {readonly string[]} [groups] - the groups of rows compared
 * @returns {{ markdown: string, text: string }}
 */
export function describeDiff(diff, base, groups = DEFAULT_GROUPS) {
  const heading = headings(base, groups)
  const markdownHeading = [heading.markdown, '']
  const textHeading = heading.text
  if (isEmptyDiff(diff)) {
    return {
      markdown: [...markdownHeading, 'No wording changes.', ''].join('\n'),
      text: `${textHeading}: none.\n`
    }
  }
  const changedCount = diff.changed.flatMap(({ ids }) => ids).length
  const sections = [
    [
      'Added',
      diff.added.length,
      rowsMarkdown(diff.added),
      rowsText(diff.added)
    ],
    [
      'Removed',
      diff.removed.length,
      rowsMarkdown(diff.removed),
      rowsText(diff.removed)
    ],
    [
      'Changed',
      changedCount,
      changedMarkdown(diff.changed),
      changedText(diff.changed)
    ],
    [
      'Status changed',
      diff.statuses.length,
      statusesMarkdown(diff.statuses),
      statusesText(diff.statuses)
    ]
  ]
  return {
    markdown: [
      ...markdownHeading,
      ...sections.flatMap(([title, count, lines]) =>
        sectionMarkdown(title, count, lines)
      )
    ].join('\n'),
    text: [
      textHeading,
      ...sections.flatMap(([title, count, , lines]) =>
        sectionText(title, count, lines)
      ),
      ''
    ].join('\n')
  }
}

/**
 * Said in place of the changes when they cannot be worked out, so the run
 * still keeps the export. Nothing is unfinished by a change not worked out.
 *
 * @param {{ markdown: string, text: string }} base
 * @param {string} reason
 * @param {readonly string[]} [groups] - the groups of rows to compare
 * @returns {{ markdown: string, text: string, unfinished: [] }}
 */
export function notCompared(base, reason, groups = DEFAULT_GROUPS) {
  const heading = headings(base, groups)
  return {
    markdown: `${heading.markdown}\n\nThe changes are not shown: ${cell(reason)}\n`,
    text: `${heading.text} are not shown: ${reason}\n`,
    unfinished: []
  }
}

/**
 * What a change makes of the export, against error-text.yaml as it was at
 * the base: said, rather than thrown, when that file is missing or cannot be
 * compared, so the run still keeps the export.
 *
 * @param {Array<Record<string, string>>} rows - rows from buildRows, after
 * @param {string | null} baseSource - error-text.yaml's text at the base, or
 *   null when the base has no such file
 * @param {{ markdown: string, text: string }} base - a link to the base, and
 *   its plain name
 * @param {readonly string[]} [groups] - the groups of rows `rows` holds, so
 *   the base is read alike
 * @returns {{ markdown: string, text: string, unfinished: ReturnType<typeof unfinishedChanges> }}
 */
export function compareWithBase(
  rows,
  baseSource,
  base,
  groups = DEFAULT_GROUPS
) {
  if (baseSource === null) {
    return notCompared(
      base,
      'error-text.yaml is not on the base commit.',
      groups
    )
  }
  try {
    const diff = diffRows(buildRows(baseSource, { groups }), rows)
    return {
      ...describeDiff(diff, base, groups),
      unfinished: unfinishedChanges(diff, rows)
    }
  } catch (error) {
    return notCompared(
      base,
      `the base commit's error-text.yaml could not be compared: ${error.message}`,
      groups
    )
  }
}

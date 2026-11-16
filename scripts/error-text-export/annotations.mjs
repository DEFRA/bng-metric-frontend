import { STATUS } from './rows.mjs'

// The changes that leave error wording unfinished, as GitHub Actions warning
// annotations: each on its entry's line of error-text.yaml, so it shows
// beside that line in a pull request's Files changed, and on the run. They
// warn, and never fail the run.
// https://docs.github.com/actions/reference/workflow-commands-for-github-actions#setting-a-warning-message

const LINE_ANCHOR = /#L(\d+)/

// GitHub keeps at most 10 warning annotations from one step, and drops the
// rest unseen.
const MAX_STEP_WARNINGS = 10

const TITLES = Object.freeze({
  [STATUS.NEEDS_CONTENT]: 'Error wording needs content',
  [STATUS.AWAITING_UCD]: 'Error wording awaiting UCD'
})

const WHAT_IT_NEEDS = Object.freeze({
  [STATUS.NEEDS_CONTENT]:
    'It has no words of its own yet, so the user sees a stand-in. UCD will need to word it.',
  [STATUS.AWAITING_UCD]:
    'Its words, or those of the shared page it shows, are interim. UCD will need to review them.'
})

// A workflow command ends at a line break, and its properties at a comma or
// a colon, so those are written as their percent codes.
function escapeData(text) {
  return text
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
}

function escapeProperty(text) {
  return escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C')
}

/** The line a row's entry starts on: its first source link's. */
function lineOf(row) {
  return LINE_ANCHOR.exec(row.source ?? '')?.[1]
}

function message({ row, before }) {
  const what = before
    ? `${row.id} moves from ${before} to ${row.status}.`
    : `New error ${row.id} is ${row.status}.`
  return `${what} ${WHAT_IT_NEEDS[row.status] ?? ''}`.trim()
}

function entryWarning(change, file) {
  const line = lineOf(change.row)
  const properties = [
    `file=${escapeProperty(file)}`,
    ...(line ? [`line=${line}`] : []),
    `title=${escapeProperty(TITLES[change.row.status] ?? 'Error wording')}`
  ]
  return `::warning ${properties.join(',')}::${escapeData(message(change))}`
}

/**
 * The last warning, in place of those GitHub would drop: how many more. Only
 * past 10, so always 2 or more: a single extra entry has the tenth slot.
 */
function moreWarning(more) {
  const title = escapeProperty('More error wording left unfinished')
  return `::warning title=${title}::${escapeData(
    `${more} more entries are left unfinished. The run's summary and log list every change.`
  )}`
}

/**
 * A warning annotation for each change that leaves wording unfinished, on
 * its entry's line. GitHub keeps only 10 from a step, so past that the
 * tenth says how many more there are, rather than GitHub dropping them unseen.
 *
 * @param {Array<{ row: Record<string, string>, before?: string }>} changes
 *   from unfinishedChanges
 * @param {string} file - error-text.yaml's path from the repository's root
 * @returns {string[]} one workflow command a line
 */
export function warningAnnotations(changes, file) {
  if (changes.length <= MAX_STEP_WARNINGS) {
    return changes.map((change) => entryWarning(change, file))
  }
  const shown = MAX_STEP_WARNINGS - 1
  return [
    ...changes.slice(0, shown).map((change) => entryWarning(change, file)),
    moreWarning(changes.length - shown)
  ]
}

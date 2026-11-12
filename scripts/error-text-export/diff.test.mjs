import {
  compareWithBase,
  describeDiff,
  diffRows,
  isEmptyDiff,
  unfinishedChanges
} from './diff.mjs'
import { ALL_GROUPS, ROW_GROUPS, SHOWN, STATUS, buildRows } from './rows.mjs'

// Two small error-text.yaml files: the second adds, removes, rewords and
// finishes entries, and moves a code from the drop-out page to an edit.
const before = `
common:
  summaryTitle: There is a problem
  unworded: There is a problem with this answer
upload:
  page:
    title: There is a problem with your file
  links: {}
  catchAll:
    legacyTemplate:
      title: Your file contains an error
      body: Check your file.
    serviceTemplate:
      title: Your file contains an error
      body: Check your file.
  fileProblem:
    title: Your file contains an error
    body: Check the habitats.
  serviceProblem:
    title: Sorry, there is a problem with the service
    body: Try again later.
  names: {}
  unknown: {}
  distinctiveness: {}
  errors:
    KEPT:
      problemsList:
        heading: Parcels are too small
    REMOVED:
      problemsList:
        heading: Gone soon
    MOVED:
      problemsList:
        heading: Moved soon
    ALONE_A:
      singleProblemPage: file-problem
      problemsList:
        heading: First
    ALONE_B:
      singleProblemPage: file-problem
      problemsList:
        heading: Second
edit: {}
forms:
  applicant:
    tooLong:
      wording: interim
      text: Applicant must be {max} characters or fewer
pages: {}
`

const after = before
  .replace(
    'heading: Parcels are too small',
    'heading: Parcels are | too <small>'
  )
  .replace(
    `    REMOVED:
      problemsList:
        heading: Gone soon
`,
    ''
  )
  .replace(
    `    MOVED:
      problemsList:
        heading: Moved soon
`,
    `    ADDED:
      problemsList:
        heading: New
`
  )
  .replace('edit: {}', 'edit:\n  MOVED:\n    summary: Moved here.')
  .replace('body: Check the habitats.', 'body: Check every habitat.')
  .replace(
    `      wording: interim
      text: Applicant`,
    '      text: Applicant'
  )

// Every group: these tests are about comparing, not which rows are given.
const all = (source) => buildRows(source, { groups: ALL_GROUPS })
const diff = diffRows(all(before), all(after))

describe('diffRows', () => {
  test('lists the IDs added and removed', () => {
    expect(diff.added.map(({ id }) => id)).toEqual(['ADDED'])
    expect(diff.removed.map(({ id }) => id)).toEqual(['REMOVED'])
  })

  test('gives each changed part before and after', () => {
    const kept = diff.changed.find(({ ids }) => ids.includes('KEPT'))
    expect(kept).toEqual({
      ids: ['KEPT'],
      parts: [
        {
          part: 'List heading',
          before: 'Parcels are too small',
          after: 'Parcels are | too <small>'
        }
      ]
    })
  })

  test('says where a code moved between sections is now shown', () => {
    const moved = diff.changed.find(({ ids }) => ids.includes('MOVED'))
    // On the drop-out page it had no single-problem page; on an edit, words.
    expect(moved.parts.map(({ part }) => part)).toEqual([
      'Where it is shown',
      'Error summary',
      'List heading',
      'Shown instead'
    ])
    expect(moved.parts[0]).toMatchObject({
      before: SHOWN.UPLOAD,
      after: SHOWN.EDIT
    })
  })

  test('makes one entry of a shared fallback and the IDs it rewords alike', () => {
    // The words are in Body alone, so the page's own row and each error
    // showing it change alike.
    const fallback = diff.changed.find(({ ids }) => ids.includes('ALONE_A'))
    expect(fallback).toEqual({
      ids: ['ALONE_A', 'ALONE_B', 'upload.fileProblem'],
      parts: [
        {
          part: 'Body',
          before: 'Check the habitats.',
          after: 'Check every habitat.'
        }
      ]
    })
  })

  test('lists each status that moved', () => {
    expect(diff.statuses).toEqual([
      {
        id: 'forms.applicant.tooLong',
        before: STATUS.AWAITING_UCD,
        after: STATUS.FINAL
      }
    ])
  })

  test('finds nothing between a file and itself', () => {
    expect(isEmptyDiff(diffRows(all(after), all(after)))).toBe(true)
  })
})

const base = {
  markdown: '[abc1234](https://x/commit/abc1234)',
  text: 'abc1234'
}
const described = describeDiff(diff, base, ALL_GROUPS)
const EVERY = ALL_GROUPS.join(', ')
const empty = diffRows(all(after), all(after))

describe('describeDiff, as Markdown for the run summary', () => {
  const { markdown } = described

  test('heads each kind of change with its count', () => {
    expect(markdown.split('\n').filter((line) => line.startsWith('#'))).toEqual(
      [
        `### Wording changes in ${EVERY} from [abc1234](https://x/commit/abc1234)`,
        '#### Added (1)',
        '#### Removed (1)',
        '#### Changed (5)',
        '#### Status changed (1)'
      ]
    )
  })

  test("gives an added error's words, part by part", () => {
    expect(markdown).toContain(
      [
        '**`ADDED`**: Drop-out page, Final',
        '',
        '| Part | Words |',
        '| --- | --- |',
        '| List heading | New |'
      ].join('\n')
    )
  })

  test('keeps wording from breaking the table or reading as Markdown', () => {
    expect(markdown).toContain(
      '| List heading | Parcels are too small | Parcels are \\| too \\<small\\> |'
    )
  })

  test('says when there is nothing to show', () => {
    expect(describeDiff(empty, base).markdown).toBe(
      '### Wording changes in codes, fallbacks from [abc1234](https://x/commit/abc1234)\n\nNo wording changes.\n'
    )
  })
})

describe('describeDiff, as plain text for the run log', () => {
  const lines = described.text.split('\n')

  test('heads each kind of change with its count', () => {
    expect(lines.filter((line) => /^\S/.test(line))).toEqual([
      `Wording changes in ${EVERY} from abc1234`,
      'Added (1)',
      'Removed (1)',
      'Changed (5)',
      'Status changed (1)'
    ])
  })

  test("gives an added or removed error's words, as typed", () => {
    expect(described.text).toContain(
      [
        '  ADDED (Drop-out page, Final)',
        '    List heading:',
        '        New'
      ].join('\n')
    )
    expect(described.text).toContain('  REMOVED (Drop-out page, Final)')
  })

  test('gives each changed part before and after, one ID a line', () => {
    expect(described.text).toContain(
      [
        '  ALONE_A',
        '  ALONE_B',
        '  upload.fileProblem',
        '    Body, before:',
        '        Check the habitats.',
        '    Body, after:',
        '        Check every habitat.'
      ].join('\n')
    )
    expect(described.text).toContain('        Parcels are | too <small>')
  })

  test('says "(none)" for a part with no words, as the summary does', () => {
    expect(described.text).toContain(
      [
        '    Error summary, before:',
        '        (none)',
        '    Error summary, after:',
        '        Moved here.'
      ].join('\n')
    )
    expect(described.markdown).toContain(
      '| Error summary | _(none)_ | Moved here. |'
    )
  })

  test('gives each status that moved', () => {
    expect(lines).toContain(
      `  forms.applicant.tooLong: ${STATUS.AWAITING_UCD} -> ${STATUS.FINAL}`
    )
  })

  test('says when there is nothing to show', () => {
    expect(describeDiff(empty, base).text).toBe(
      'Wording changes in codes, fallbacks from abc1234: none.\n'
    )
  })

  test('names the groups it compared, so a "none" is not read as more', () => {
    const groups = [ROW_GROUPS.CODES, ROW_GROUPS.FORMS]
    expect(describeDiff(empty, base, groups).text).toBe(
      'Wording changes in codes, forms from abc1234: none.\n'
    )
  })
})

describe('compareWithBase', () => {
  const rows = all(after)

  test('compares with the base file', () => {
    expect(compareWithBase(rows, before, base, ALL_GROUPS)).toEqual({
      ...described,
      unfinished: []
    })
  })

  test('reads the base as the default groups unless told otherwise', () => {
    const { text } = compareWithBase(buildRows(after), before, base)
    expect(text).not.toContain('forms.applicant.tooLong')
    expect(text).toContain('  ADDED (')
  })

  test('says so when the base has no error-text.yaml', () => {
    const { markdown, text, unfinished } = compareWithBase(rows, null, base)
    expect(unfinished).toEqual([])
    expect(markdown).toContain('error-text.yaml is not on the base commit')
    expect(text).toBe(
      'Wording changes in codes, fallbacks from abc1234 are not shown: error-text.yaml is not on the base commit.\n'
    )
  })

  test('says so, rather than failing, when the base file cannot be read', () => {
    expect(compareWithBase(rows, 'upload: [', base).markdown).toMatch(
      /^### Wording changes in codes, fallbacks from \[abc1234\]\(https:\/\/x\/commit\/abc1234\)\n\nThe changes are not shown: the base commit's error-text\.yaml could not be compared: /
    )
  })

  test('says so, rather than failing, when a base value is not text', () => {
    const listNote = before.replace(
      'heading: Parcels are too small',
      'heading: Parcels are too small\n        note: [one, two]'
    )
    expect(() => compareWithBase(rows, listNote, base)).not.toThrow()
  })
})

describe('unfinishedChanges', () => {
  const row = (id, status) => ({ id, status })
  const rows = [
    row('NEW_FINAL', STATUS.FINAL),
    row('NEW_INTERIM', STATUS.AWAITING_UCD),
    row('NEW_NONE', STATUS.NEEDS_CONTENT),
    row('WORSE', STATUS.AWAITING_UCD),
    row('BETTER', STATUS.FINAL)
  ]
  const changes = unfinishedChanges(
    {
      added: rows.slice(0, 3),
      removed: [],
      changed: [],
      statuses: [
        { id: 'WORSE', before: STATUS.FINAL, after: STATUS.AWAITING_UCD },
        { id: 'BETTER', before: STATUS.AWAITING_UCD, after: STATUS.FINAL }
      ]
    },
    rows
  )

  test('gives each added error that is not final', () => {
    expect(changes.filter((c) => !c.before).map((c) => c.row.id)).toEqual([
      'NEW_INTERIM',
      'NEW_NONE'
    ])
  })

  test('gives each error whose status moves back, and not one that moves on', () => {
    expect(changes.filter((c) => c.before)).toEqual([
      { row: rows[3], before: STATUS.FINAL }
    ])
  })

  test('gives nothing for a change that adds only final wording and finishes some', () => {
    // The small files: ADDED is final, and forms.applicant.tooLong moves on.
    expect(unfinishedChanges(diff, all(after))).toEqual([])
  })
})

import { readFileSync } from 'node:fs'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import {
  PROBLEMS_LIST_CATCH_ALL,
  SHARED_PAGE
} from '../../src/server/error-file/dropout-copy.js'
import { PLACEHOLDERS } from './placeholders.mjs'
import { readErrorTextSource } from './read.mjs'
import {
  ALL_GROUPS,
  ALONE,
  COLUMNS,
  DEFAULT_GROUPS,
  FALLBACKS,
  ROW_GROUPS,
  NOT_EXPLAINED,
  SHOWN,
  STATUS,
  buildRows,
  statusCounts
} from './rows.mjs'

const source = readFileSync(ERROR_TEXT_FILE, 'utf8')
const { value } = readErrorTextSource(source)
// Every group, so each kind of row is still built and checked.
const rows = buildRows(source, { groups: ALL_GROUPS })
const rowOf = (id) => rows.find((row) => row.id === id)

// What an upload error's singleProblemPage and problemsList name in place of words.
const KEYWORDS = new Set([
  ...Object.values(SHARED_PAGE),
  PROBLEMS_LIST_CATCH_ALL
])

/** Every string a customer can see, with its place in the file. */
function wordingIn(node, path = []) {
  if (typeof node === 'string') {
    const key = path.at(-1)
    const named =
      (key === 'singleProblemPage' || key === 'problemsList') &&
      KEYWORDS.has(node)
    return key === 'wording' || named
      ? []
      : [{ path: path.join('.'), text: node }]
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, child]) =>
      // The links are addresses, named in the Links column, not wording.
      path.join('.') === 'upload' && key === 'links'
        ? []
        : wordingIn(child, [...path, key])
    )
  }
  return []
}

// A file with one of each kind of entry, small enough to read in a test.
const FIXTURE = `
common:
  summaryTitle: There is a problem
  unworded:
    wording: interim
    text: There is a problem with this answer
upload:
  page:
    title: There is a problem with your file
  links:
    metric-tool: https://example.com/metric
  catchAll:
    legacyTemplate:
      title: Your file contains an error
      body: Rename the layers and [upload a new file](upload).
    serviceTemplate:
      title: Your file contains an error
      body: Match the template and [upload a new file](upload).
  fileProblem:
    wording: interim
    title: Your file contains an error
    body: Check the habitats.
  serviceProblem:
    title: Sorry, there is a problem with the service
    body: Try again later.
  names:
    feature:
      - Feature Ref {featureRef}
      - feature
  unknown:
    area: blank
  distinctiveness:
    V.High: Very high
  layers:
    hedgerows: Hedgerows
  errors:
    # A layer the template does not have.
    B_LAYER:
      singleProblemPage: catch-all
      problemsList:
        heading: 'Layer "{layer}" is not expected'
        variants:
          bng-service:
            heading: 'Layer "{layer}" is not in the template'
    a_parcel:
      singleProblemPage:
        title:
          - This parcel {ref} contains an error
          - Your file contains an error
        body: Draw it again and [upload a new file](upload).
      problemsList:
        heading: Parcels are too small
        item:
          - '{feature}'
          - ' — {area} sq m'
    BOTH:
      wording: none
      singleProblemPage: file-problem
      problemsList: catch-all
    C_ALONE:
      singleProblemPage: file-problem
      problemsList:
        heading: Habitats are not valid
    D_LISTED:
      singleProblemPage:
        title: Your habitats contain an error
        body: Check them.
      problemsList: catch-all
    UNKNOWN_WORDING:
      wording: someday
      problemsList:
        heading: Something {mystery}
edit:
  BOTH:
    # Not shown by the pages yet.
    wording: none
  EDIT_ONLY:
    summary: You have entered a reference in use.
    inline: Enter a reference not in use.
forms:
  projectName:
    # Blank.
    required: Enter a project name
    tooLong: Project name must be {max} characters or fewer
  applicant:
    tooLong:
      wording: interim
      text: Applicant must be {max} characters or fewer
  pair:
    both:
      summary: Not both.
      inline: One must be zero.
  unworded:
    rule:
      wording: none
pages:
  notFound:
    title: Page not found
  accessDenied:
    body:
      - You do not have permission.
      - '[Return to the home page](home)'
`
const fixture = buildRows(FIXTURE, {
  groups: ALL_GROUPS,
  sourceUrl: (line) => `https://x/f#L${line}`
})
const fixtureRow = (id) => fixture.find((row) => row.id === id)

describe('buildRows, what an error shows when it is the only problem', () => {
  test.each([
    ['HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', ALONE.OWN],
    ['PARCEL_OVERLAPS', ALONE.OWN_ONE_AND_SEVERAL],
    ['AREA_PARCELS_TOO_SMALL', ALONE.OWN_ONE_ONLY],
    ['TEMPLATE_VERSION_DUPLICATED', ALONE.PROBLEMS_LIST],
    ['STAGED_UNKNOWN_PARENT_REF', ALONE.PROBLEMS_LIST]
  ])('says %s shows %s', (id, alone) => {
    expect(rowOf(id).alone).toBe(alone)
  })

  test('says a code on a shared page shows it, and names it', () => {
    const shared = rows.find(({ alone }) => alone === ALONE.SHARED)
    expect(shared.fallback).toMatch(/, when alone$/m)
  })

  test("gives a page's wording for several in its own columns", () => {
    const row = rowOf('PARCEL_OVERLAPS')
    expect(row.pageHeading).toContain('These parcels {refA}, {refB}')
    expect(row.pageHeadingSeveral).toBe(
      'Your Geopackage (.gpkg) file contains an error'
    )
    expect(row.bodySeveral).toContain(
      'Some parcels in this file are overlapping'
    )
  })

  test('leaves the several columns empty for a page worded for one only', () => {
    const row = rowOf('AREA_PARCELS_TOO_SMALL')
    expect(row.pageHeading).toContain('This parcel {ref} contains an error')
    expect(row.pageHeadingSeveral).toBe('')
    expect(row.bodySeveral).toBe('')
  })

  test('marks an error with only a heading, and no single-problem page, as awaiting UCD', () => {
    expect(rowOf('TEMPLATE_VERSION_DUPLICATED').status).toBe(
      STATUS.AWAITING_UCD
    )
  })
})

describe('buildRows, from error-text.yaml', () => {
  test('every customer-facing string in the file appears in a row', () => {
    const text = rows
      .map((row) => COLUMNS.map(({ key }) => row[key]).join('\n'))
      .join('\n')
    const missing = wordingIn(value).filter(
      ({ text: words }) => !text.includes(words)
    )
    expect(missing).toEqual([])
  })

  test('has one row per error ID', () => {
    const ids = rows.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('has a row for every upload, edit, forms and pages entry', () => {
    const ids = new Set(rows.map((row) => row.id))
    const expected = [
      ...Object.keys(value.upload.errors),
      ...Object.keys(value.edit),
      ...Object.entries(value.forms).flatMap(([field, rules]) =>
        Object.keys(rules).map((rule) => `forms.${field}.${rule}`)
      ),
      ...Object.keys(value.pages).map((key) => `pages.${key}`)
    ]
    expect(expected.filter((id) => !ids.has(id))).toEqual([])
  })

  test('explains every {name} and link target the file uses', () => {
    const unexplained = rows.filter(
      (row) =>
        row.values.includes(NOT_EXPLAINED) || row.links.includes(NOT_EXPLAINED)
    )
    expect(
      unexplained.map(({ id, values, links }) => ({ id, values, links }))
    ).toEqual([])
  })

  test('gives every {max} the number the page applies', () => {
    const limits = rows.filter((row) => row.values.includes('{max}'))
    expect(limits.length).toBeGreaterThan(0)
    for (const row of limits) {
      expect(row.values).not.toContain(`{max}: ${PLACEHOLDERS.max}`)
      expect(row.values).toMatch(/\{max\}: .*: \d/)
    }
  })

  test('is sorted by error ID, ignoring case', () => {
    const ids = rows.map((row) => row.id)
    const sorted = [...ids].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    )
    expect(ids).toEqual(sorted)
  })

  test('links each row to the line its entry starts on', () => {
    const lines = source.split('\n')
    for (const row of rows) {
      for (const url of row.source.split('\n')) {
        const line = Number(url.replace('#L', ''))
        const [key] = lines[line - 1].trim().split(':')
        expect(row.id.endsWith(key)).toBe(true)
      }
    }
  })

  test.each([
    ['upload.catchAll', 'catch-all'],
    ['upload.fileProblem', 'file-problem'],
    ['upload.serviceProblem', 'service-problem']
  ])('%s lists every error shown with it alone', (id, name) => {
    const codes = Object.entries(value.upload.errors)
      .filter(([, entry]) => entry.singleProblemPage === name)
      .map(([code]) => code)
    expect(rowOf(id).fallback.split('\n')[0]).toBe(
      `Shown alone by ${codes.length}: ${codes.join(', ')}`
    )
  })
})

describe('buildRows, by group', () => {
  const ids = (groups) => buildRows(FIXTURE, { groups }).map(({ id }) => id)

  test('gives only the error codes by default', () => {
    expect(DEFAULT_GROUPS).toEqual([ROW_GROUPS.CODES])
    expect(buildRows(FIXTURE).map(({ id }) => id)).toEqual([
      'a_parcel',
      'B_LAYER',
      'BOTH',
      'C_ALONE',
      'D_LISTED',
      'EDIT_ONLY',
      'UNKNOWN_WORDING'
    ])
  })

  test('gives each group asked for, and only those', () => {
    expect(ids([ROW_GROUPS.FORMS])).toEqual([
      'forms.applicant.tooLong',
      'forms.pair.both',
      'forms.projectName.required',
      'forms.projectName.tooLong',
      'forms.unworded.rule'
    ])
    expect(ids([ROW_GROUPS.PAGES, ROW_GROUPS.COMMON])).toEqual([
      'common.summaryTitle',
      'common.unworded',
      'pages.accessDenied',
      'pages.notFound'
    ])
    expect(ids([ROW_GROUPS.FALLBACKS])).toEqual([
      'upload.catchAll',
      'upload.fileProblem',
      'upload.serviceProblem'
    ])
  })

  test('gives every row from every group', () => {
    expect(ids(ALL_GROUPS)).toEqual(fixture.map(({ id }) => id))
  })

  test('still names a fallback a code shows, without its row', () => {
    const [row] = buildRows(FIXTURE).filter(({ id }) => id === 'B_LAYER')
    expect(row.fallback).toBe('Catch-all (upload.catchAll), when alone')
    expect(row.pageHeading).toBe('Your file contains an error')
  })

  test('refuses a group it does not know, naming those it does', () => {
    expect(() => buildRows(FIXTURE, { groups: ['form'] })).toThrow(
      `Unknown row group form: choose from ${ALL_GROUPS.join(', ')}`
    )
  })
})

describe('FALLBACKS', () => {
  test('has a fallback for every shared page singleProblemPage can name', () => {
    expect(Object.keys(FALLBACKS).sort()).toEqual(
      Object.values(SHARED_PAGE).sort()
    )
  })
})

describe('buildRows, from a small file', () => {
  test('orders IDs as a reader would, ignoring case', () => {
    expect(fixture.map((row) => row.id)).toEqual([
      'a_parcel',
      'B_LAYER',
      'BOTH',
      'C_ALONE',
      'common.summaryTitle',
      'common.unworded',
      'D_LISTED',
      'EDIT_ONLY',
      'forms.applicant.tooLong',
      'forms.pair.both',
      'forms.projectName.required',
      'forms.projectName.tooLong',
      'forms.unworded.rule',
      'pages.accessDenied',
      'pages.notFound',
      'UNKNOWN_WORDING',
      'upload.catchAll',
      'upload.distinctiveness.V.High',
      'upload.fileProblem',
      'upload.layers.hedgerows',
      'upload.names.feature',
      'upload.page.title',
      'upload.serviceProblem',
      'upload.unknown.area'
    ])
  })

  test('reads the status from the wording field', () => {
    expect(fixtureRow('forms.projectName.required').status).toBe(STATUS.FINAL)
    expect(fixtureRow('forms.applicant.tooLong').status).toBe(
      STATUS.AWAITING_UCD
    )
    expect(fixtureRow('forms.unworded.rule').status).toBe(STATUS.NEEDS_CONTENT)
    expect(fixtureRow('upload.fileProblem').status).toBe(STATUS.AWAITING_UCD)
  })

  test('counts an unrecognised wording value as needing content', () => {
    expect(fixtureRow('UNKNOWN_WORDING').status).toBe(STATUS.NEEDS_CONTENT)
  })

  test('is no further on than a fallback it shows alone', () => {
    expect(fixtureRow('C_ALONE').status).toBe(STATUS.AWAITING_UCD)
  })

  test('is no further on than the catch-all whose title heads its list', () => {
    expect(fixtureRow('D_LISTED').status).toBe(STATUS.FINAL)
    const interim = FIXTURE.replace(
      '  catchAll:\n    legacyTemplate:\n',
      '  catchAll:\n    legacyTemplate:\n      wording: interim\n'
    )
    const row = buildRows(interim, { groups: ALL_GROUPS }).find(
      ({ id }) => id === 'D_LISTED'
    )
    expect(row.status).toBe(STATUS.AWAITING_UCD)
  })

  test('counts each status', () => {
    expect(statusCounts(fixture)).toEqual({
      [STATUS.NEEDS_CONTENT]: 3,
      [STATUS.AWAITING_UCD]: 4,
      [STATUS.FINAL]: 17
    })
  })

  test('copies a shared fallback into a row, and names it', () => {
    const row = fixtureRow('B_LAYER')
    expect(row.pageHeading).toBe('Your file contains an error')
    expect(row.body).toBe(
      'Legacy template: Rename the layers and [upload a new file](upload).\n' +
        'BNG Service template: Match the template and [upload a new file](upload).'
    )
    expect(row.fallback).toBe('Catch-all (upload.catchAll), when alone')
  })

  test('heads a catch-all list entry with the catch-all title', () => {
    const row = fixtureRow('BOTH')
    expect(row.listHeading).toBe('Your file contains an error')
    expect(row.fallback).toContain(
      'Catch-all (upload.catchAll) title, in a list'
    )
  })

  test('gives each fallback a row naming the errors that show it', () => {
    expect(fixtureRow('upload.catchAll')).toMatchObject({
      shown: SHOWN.FALLBACK,
      fallback:
        'Shown alone by 1: B_LAYER\nIts title heads a list by 2: BOTH, D_LISTED'
    })
    expect(fixtureRow('upload.fileProblem').fallback).toBe(
      'Shown alone by 2: BOTH, C_ALONE'
    )
  })

  test('makes one row of a code met on the drop-out page and on an edit', () => {
    const row = fixtureRow('BOTH')
    expect(row.shown).toBe(`${SHOWN.UPLOAD}; ${SHOWN.EDIT}`)
    expect(row.status).toBe(STATUS.NEEDS_CONTENT)
    expect(row.source.split('\n')).toHaveLength(2)
    expect(row.fallback).toContain(`${SHOWN.EDIT}: None yet`)
  })

  test('words a layout given as options, and a bullet given as parts', () => {
    const row = fixtureRow('a_parcel')
    expect(row.pageHeading).toBe(
      'This parcel {ref} contains an error\nOtherwise: Your file contains an error'
    )
    expect(row.item).toBe('{feature} — {area} sq m')
    expect(row.values).toContain('A part of a bullet is left out')
  })

  test('words each variant beside the code’s own wording', () => {
    expect(fixtureRow('B_LAYER').listHeading).toBe(
      'Layer "{layer}" is not expected\nbng-service variant: Layer "{layer}" is not in the template'
    )
  })

  test('explains the values a row fills in and the links it holds', () => {
    const row = fixtureRow('a_parcel')
    expect(row.values.split('\n')).toEqual([
      `{ref}: ${PLACEHOLDERS.ref}`,
      `{feature}: ${PLACEHOLDERS.feature}`,
      `{area}: ${PLACEHOLDERS.area}`,
      'A part of a bullet is left out when any of its values is not known.'
    ])
    expect(row.links).toBe('upload: the upload page')
    expect(fixtureRow('pages.accessDenied').links).toBe(
      "home: the service's home page"
    )
  })

  test('says when a {name} has no explanation', () => {
    expect(fixtureRow('UNKNOWN_WORDING').values).toBe(
      `{mystery}: ${NOT_EXPLAINED}`
    )
  })

  test('shows a form rule with one text in both the summary and inline', () => {
    expect(fixtureRow('forms.applicant.tooLong')).toMatchObject({
      summary: 'Applicant must be {max} characters or fewer',
      inline: 'Applicant must be {max} characters or fewer'
    })
    expect(fixtureRow('forms.pair.both')).toMatchObject({
      summary: 'Not both.',
      inline: 'One must be zero.'
    })
  })

  test('shows common.unworded for a form rule with no wording', () => {
    expect(fixtureRow('forms.unworded.rule')).toMatchObject({
      summary: 'There is a problem with this answer',
      fallback: 'common.unworded'
    })
  })

  test('has no column for the file’s comments', () => {
    expect(COLUMNS.map(({ key }) => key)).not.toContain('comments')
    expect(Object.keys(fixtureRow('B_LAYER'))).toEqual(
      COLUMNS.map(({ key }) => key)
    )
  })

  test('links to the entry’s line', () => {
    const line =
      FIXTURE.split('\n').findIndex((text) => text.trim() === 'B_LAYER:') + 1
    expect(fixtureRow('B_LAYER').source).toBe(`https://x/f#L${line}`)
  })
})

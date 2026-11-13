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

describe('buildRows, an edit with no words of its own', () => {
  const REFUSED =
    'If a change made on screen is refused: the error page pages.badRequest, in place of the form'

  test('gives, in Shown instead, the words of the error page a refused change shows', () => {
    const { title } = value.pages.badRequest
    expect(rowOf('ENHANCEMENT_NOT_VALID').shownInstead).toBe(
      `${REFUSED}\nHeading: ${title}`
    )
  })

  test('says so of the edit, in a row with drop-out page wording too', () => {
    expect(
      rowOf('HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE').shownInstead
    ).toContain(REFUSED)
  })

  // An edit with no words and no wording field, and an interim error page
  // with a body: the small file has neither.
  const quiet = buildRows(
    FIXTURE.replace('edit:\n', 'edit:\n  QUIET_EDIT: {}\n').replace(
      'pages:\n',
      [
        'pages:',
        '  badRequest:',
        '    wording: interim',
        '    title: Bad Request',
        '    body:',
        '      - Check what you entered.',
        '      - Try again.',
        ''
      ].join('\n')
    )
  ).find(({ id }) => id === 'QUIET_EDIT')

  test("gives the page's heading and each line of its body", () => {
    expect(quiet.shownInstead).toBe(
      [
        REFUSED,
        'Heading: Bad Request',
        'Body: Check what you entered.',
        'Body: Try again.'
      ].join('\n')
    )
  })

  test('is no further on than the page shown in its place', () => {
    expect(quiet.status).toBe(STATUS.AWAITING_UCD)
  })
})

describe('buildRows, a page given in versions', () => {
  test('gives each version a line, after when it is shown, alike in every cell', () => {
    const row = rowOf('BASELINE_HABITATS_INCOMPLETE')
    // The same in every version: once.
    expect(row.pageHeading).toBe('There is a problem with your file')
    expect(row.subheading).toBe(
      [
        'If {onlyLayer} and {onlyRef} are known: {onlyLayer}',
        'If {sharedLayer} is known: {sharedLayer}',
        'Otherwise: (none)'
      ].join('\n')
    )
    expect(row.body.split('\n')).toEqual([
      expect.stringMatching(
        /^If \{onlyLayer\} and \{onlyRef\} are known: Baseline habitat \{onlyRef\} /
      ),
      expect.stringMatching(/^If \{sharedLayer\} is known: Some baseline /),
      expect.stringMatching(/^Otherwise: Some baseline /)
    ])
  })

  test('says when each version is shown in its own cells, for several too', () => {
    const row = rowOf('BASELINE_HABITATS_INCOMPLETE')
    expect(row.subheadingSeveral).toBe(
      'If {sharedLayer} is known: {sharedLayer}\nOtherwise: (none)'
    )
    // Not in another column, to be matched up.
    expect(row.values).not.toMatch(/version/i)
  })

  test('says when a backup heading is used, by the value it does without', () => {
    expect(rowOf('AREA_PARCELS_TOO_SMALL').pageHeading).toBe(
      'This parcel {ref} contains an error\nIf {ref} is not known: Your Geopackage (.gpkg) file contains an error'
    )
  })

  test("says a version's condition by the values its parts always need", () => {
    // Version 1's heading has a backup, so it can always be filled: only its
    // body's {area} decides whether version 1 is shown.
    const source = FIXTURE.replace(
      '  errors:\n',
      [
        '  errors:',
        '    VERSIONED:',
        '      singleProblemPage:',
        '        - title:',
        '            - This parcel {ref} is too small',
        '            - A parcel is too small',
        '          body: It is {area} sq m.',
        '        - title: A parcel is too small',
        '          body: Draw it again.',
        '      problemsList:',
        '        heading: Parcels are too small',
        ''
      ].join('\n')
    )
    const row = buildRows(source).find(({ id }) => id === 'VERSIONED')
    // Version 1's backup heading indented under it, not read as a version.
    expect(row.pageHeading).toBe(
      [
        'If {area} is known: This parcel {ref} is too small',
        '  If {ref} is not known: A parcel is too small',
        'Otherwise: A parcel is too small'
      ].join('\n')
    )
    expect(row.body).toBe(
      'If {area} is known: It is {area} sq m.\nOtherwise: Draw it again.'
    )
  })

  test('numbers no versions, as each line says when it is shown', () => {
    const cells = rows.flatMap((row) => Object.values(row))
    expect(cells.filter((cell) => /\bVersions? \d/.test(String(cell)))).toEqual(
      []
    )
  })
})

describe('buildRows, shown in the problems list for want of a page', () => {
  const LIST = "the problems list, under this error's heading (in List heading)"

  test('says so of an error with no single-problem page', () => {
    expect(rowOf('TEMPLATE_VERSION_MISSING').shownInstead).toBe(
      `If this is the file's only problem: ${LIST}`
    )
  })

  test('says so of a page worded for one habitat, for several', () => {
    expect(rowOf('AREA_PARCELS_TOO_SMALL').shownInstead).toBe(
      `With several habitats: ${LIST}`
    )
  })

  test('says nothing of a page worded for one and several, or for any number', () => {
    expect(rowOf('PARCEL_OVERLAPS').shownInstead).toBe('')
    expect(rowOf('NO_REDLINE').shownInstead).toBe('')
  })
})

describe('buildRows, a single-problem page', () => {
  test('has no When it is the only problem column', () => {
    expect(COLUMNS.map(({ key }) => key)).not.toContain('alone')
    expect(rowOf('PARCEL_OVERLAPS')).not.toHaveProperty('alone')
  })

  test('names the shared page and list heading a code shows, pointing at their words', () => {
    const row = rowOf('FILENAME_TOO_LONG')
    expect(row.sharedPage).toBe(
      'Catch-all (upload.catchAll): words in Page heading and Body'
    )
    expect(row.sharedHeading).toBe(
      'Catch-all title (upload.catchAll): words in List heading'
    )
    // The words are in the row's own columns, once each.
    expect(row.pageHeading).toBe(
      'Your Geopackage (.gpkg) file contains an error'
    )
    expect(row.body).toMatch(/^For a legacy template file: The layer names /)
    expect(row.listHeading).toBe(
      'Your Geopackage (.gpkg) file contains an error'
    )
    expect(row.shownInstead).toBe('')
  })

  test('has no Shared fallback or Text column', () => {
    const keys = COLUMNS.map(({ key }) => key)
    expect(keys).not.toContain('fallback')
    expect(keys).not.toContain('text')
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
    // As the user sees it: a link by its text, as the export shows it.
    const asShown = (words) => words.replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    const missing = wordingIn(value).filter(
      ({ text: words }) => !text.includes(asShown(words))
    )
    expect(missing).toEqual([])
  })

  test('shows a link by its text, and says where it goes in Links', () => {
    const row = rowOf('AREA_PARCELS_TOO_SMALL')
    expect(row.body).toContain('Draw the parcel again and upload a new file.')
    expect(row.body).not.toContain('](upload)')
    // The words it is shown as, and where it goes.
    expect(row.links).toBe('"upload a new file": the upload page')
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
    expect(rowOf(id).sharedPage).toBe(
      `Shown alone by ${codes.length}: ${codes.join(', ')}`
    )
  })
})

describe('buildRows, by group', () => {
  const ids = (groups) => buildRows(FIXTURE, { groups }).map(({ id }) => id)

  test('gives the error codes and the shared pages by default', () => {
    expect(DEFAULT_GROUPS).toEqual([ROW_GROUPS.CODES, ROW_GROUPS.FALLBACKS])
    expect(buildRows(FIXTURE).map(({ id }) => id)).toEqual([
      'a_parcel',
      'B_LAYER',
      'BOTH',
      'C_ALONE',
      'D_LISTED',
      'EDIT_ONLY',
      'UNKNOWN_WORDING',
      'upload.catchAll',
      'upload.fileProblem',
      'upload.serviceProblem'
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
    const [row] = buildRows(FIXTURE, { groups: [ROW_GROUPS.CODES] }).filter(
      ({ id }) => id === 'B_LAYER'
    )
    expect(row.sharedPage).toBe(
      'Catch-all (upload.catchAll): words in Page heading and Body'
    )
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
      'For a legacy template file: Rename the layers and upload a new file.\n' +
        'For a BNG Service template file: Match the template and upload a new file.'
    )
    expect(row.sharedPage).toBe(
      'Catch-all (upload.catchAll): words in Page heading and Body'
    )
  })

  test('gives a shared page worded alike for every template once', () => {
    const row = fixtureRow('C_ALONE')
    expect(row.body).toBe('Check the habitats.')
    expect(row.sharedPage).toBe(
      'File problem (upload.fileProblem): words in Page heading and Body'
    )
  })

  test('heads a catch-all list entry with the catch-all title', () => {
    const row = fixtureRow('BOTH')
    expect(row.listHeading).toBe('Your file contains an error')
    expect(row.sharedHeading).toBe(
      'Catch-all title (upload.catchAll): words in List heading'
    )
  })

  test('gives each fallback a row naming the errors that show it', () => {
    expect(fixtureRow('upload.catchAll')).toMatchObject({
      shown: SHOWN.FALLBACK,
      sharedPage: 'Shown alone by 1: B_LAYER',
      sharedHeading: 'Its title heads a list by 2: BOTH, D_LISTED'
    })
    expect(fixtureRow('upload.fileProblem').sharedPage).toBe(
      'Shown alone by 2: BOTH, C_ALONE'
    )
  })

  test('makes one row of a code met on the drop-out page and on an edit', () => {
    const row = fixtureRow('BOTH')
    expect(row.shown).toBe(`${SHOWN.UPLOAD}; ${SHOWN.EDIT}`)
    expect(row.status).toBe(STATUS.NEEDS_CONTENT)
    expect(row.source.split('\n')).toHaveLength(2)
    expect(row.shownInstead).toContain('If a change made on screen is refused')
  })

  test('words a layout given as options, and a bullet given as parts', () => {
    const row = fixtureRow('a_parcel')
    expect(row.pageHeading).toBe(
      'This parcel {ref} contains an error\nIf {ref} is not known: Your file contains an error'
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
    expect(row.links).toBe('"upload a new file": the upload page')
    expect(fixtureRow('pages.accessDenied').links).toBe(
      '"Return to the home page": the service\'s home page'
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
      shownInstead: 'common.unworded: words in Error summary and Inline message'
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

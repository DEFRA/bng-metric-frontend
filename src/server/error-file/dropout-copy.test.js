import { dump } from 'js-yaml'
import { describe, test, expect } from 'vitest'

import { config } from '../../config/config.js'
import { errorText } from '../common/error-text/error-text.js'

import {
  LINK_TARGETS,
  PAGE_TEXT_VALUES,
  SHARED_PAGE,
  canFill,
  dropoutCopy,
  errorCopy,
  fill,
  firstKnown,
  joinKnownParts,
  pageText,
  parseDropoutCopy,
  sharedPage,
  singleProblemPages,
  splitLink
} from './dropout-copy.js'
import {
  NOTE_VALUE_NAMES,
  detailValueNames,
  itemValueNames
} from './controller.js'
import { pageValueNames, resolveSingleErrorCopy } from './single-error-copy.js'
import { WORDING_STATUS, wordingStatus } from '../common/error-text/wording.js'

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn, info: vi.fn(), error: vi.fn() })
}))

// The drop-out page's copy: error-text.yaml's upload section, as YAML.
const COPY_SOURCE = dump(errorText.upload)

// The {values} the code fills in for names. A name outside these would be
// left blank on the page, so a typo such as {Ref} fails here.
const NAME_VALUES = new Set(['featureRef', 'fid', 'idx', 'ref'])

function placeholders(templates) {
  return [templates]
    .flat()
    .flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map(([, name]) => name))
}

const entries = Object.entries(dropoutCopy.errors)

/** A code's problemsList variants, as a list. */
function variantsOf(problemsList) {
  return Object.values(problemsList.variants ?? {})
}

/** Every page an entry's singleProblemPage gives: plain, or one and several. */
function pagesOf(entry) {
  const page = entry.singleProblemPage
  if (typeof page !== 'object') {
    return []
  }
  return Object.hasOwn(page, 'one')
    ? [page.one, page.several ?? []].flat()
    : [page].flat()
}

const allPages = [
  ...entries.flatMap(([, entry]) => pagesOf(entry)),
  dropoutCopy.catchAll.legacyTemplate,
  dropoutCopy.catchAll.serviceTemplate,
  dropoutCopy.fileProblem,
  dropoutCopy.serviceProblem
]

describe("error-text.yaml's upload section", () => {
  // {ref} and the like name the first habitat an error names, so a page
  // that uses one is worded for one, and must say so with `one:`.
  test('words no page for any number of habitats with a value naming one', () => {
    const naming = /\{(ref|refA|refB|onlyRef|onlyLayer)\}/
    const plain = entries.filter(([, entry]) => {
      const page = entry.singleProblemPage
      return typeof page === 'object' && !Object.hasOwn(page, 'one')
    })
    for (const [code, entry] of plain) {
      expect(JSON.stringify(entry.singleProblemPage), code).not.toMatch(naming)
    }
  })

  test('gives every error its problems list entry', () => {
    for (const [code, entry] of entries) {
      expect(entry.problemsList, code).toBeDefined()
    }
  })

  test('marks every error with no single-problem page, but a lineage one, as interim', () => {
    // A lineage error is its list of habitats, by design. Any other with no
    // single-problem page is waiting for UCD to word one.
    const unworded = entries.filter(
      ([code, entry]) =>
        entry.singleProblemPage === undefined && !code.startsWith('STAGED_')
    )
    for (const [code, entry] of unworded) {
      if (entry.problemsList?.item) {
        continue
      }
      expect(wordingStatus(entry), code).toBe(WORDING_STATUS.INTERIM)
    }
  })

  test('names only the {values} the page fills in', () => {
    for (const page of allPages) {
      const words = [page.title, page.subheading, page.body]
        .flat()
        .filter(Boolean)
      for (const name of placeholders(words)) {
        expect(pageValueNames(), `${page.title}: {${name}}`).toContain(name)
      }
    }
    // Each code's bullets against the values the code supplies for that code,
    // so {location} on a lineage bullet fails even though another code has it.
    // An item names a habitat's values and a detail the error's details, in
    // any of its variants.
    const bulletsOf = (problemsList, key) =>
      [problemsList[key], ...variantsOf(problemsList).map((v) => v[key])]
        .filter(Boolean)
        .flat()
    for (const [code, { problemsList }] of entries) {
      // An item is shown once for each habitat, so one that names none of the
      // habitat's values says the same thing every time: it is a detail.
      const items = [
        problemsList.item,
        ...variantsOf(problemsList).map((v) => v.item)
      ]
      for (const item of items.filter(Boolean)) {
        expect(
          placeholders([item].flat()),
          `${code} item: ${item}`
        ).not.toEqual([])
      }
      for (const name of placeholders(bulletsOf(problemsList, 'item'))) {
        expect(itemValueNames(code), `${code} item: {${name}}`).toContain(name)
      }
      for (const name of placeholders(bulletsOf(problemsList, 'detail'))) {
        expect(detailValueNames(code), `${code} detail: {${name}}`).toContain(
          name
        )
      }
    }
    for (const name of placeholders([
      ...[dropoutCopy.names.feature].flat(),
      ...[dropoutCopy.names.habitat].flat()
    ])) {
      expect(NAME_VALUES, `{${name}}`).toContain(name)
    }
  })

  // The page's own strings, list notes and headings, and the fallback pages:
  // each is filled with its own few values, or none, so a typo such as
  // {Count} would otherwise leave a blank on every page.
  test('names only the {values} each page string, note, heading and fallback page is filled with', () => {
    for (const [key, value] of Object.entries(dropoutCopy.page)) {
      for (const name of placeholders(value)) {
        expect(PAGE_TEXT_VALUES[key] ?? [], `page.${key}: {${name}}`).toContain(
          name
        )
      }
    }
    for (const [code, { problemsList }] of entries) {
      for (const name of placeholders(problemsList.note ?? [])) {
        expect(NOTE_VALUE_NAMES, `${code} note: {${name}}`).toContain(name)
      }
      const headings = [
        problemsList.heading,
        ...variantsOf(problemsList).map((v) => v.heading)
      ]
      for (const name of placeholders(headings.filter(Boolean))) {
        expect(detailValueNames(code), `${code} heading: {${name}}`).toContain(
          name
        )
      }
    }
    // A fallback is shown for problems that send different values, so it
    // names none.
    for (const fallback of ['fileProblem', 'serviceProblem']) {
      const { title, body } = dropoutCopy[fallback]
      expect(placeholders([title, body].flat()), fallback).toEqual([])
    }
    for (const section of ['unknown', 'distinctiveness', 'links']) {
      expect(
        placeholders(Object.values(dropoutCopy[section])),
        section
      ).toEqual([])
    }
  })

  test('links only to the upload page or the metric tool', () => {
    for (const page of allPages) {
      for (const body of [page.body].flat()) {
        const { target } = splitLink(body)
        if (target) {
          expect(Object.values(LINK_TARGETS), body).toContain(target)
        }
      }
    }
  })

  // With nowhere to upload to, the page ends the sentence at the word before
  // " and", so the upload link has to follow one.
  test('puts " and " before every upload link', () => {
    for (const page of allPages) {
      for (const body of [page.body].flat()) {
        const { before, target, after } = splitLink(body)
        if (target === LINK_TARGETS.UPLOAD) {
          expect(before, body).toMatch(/ and $/)
          expect(after, body).toBe('.')
        }
      }
    }
  })

  // The page falls back to the last page given, and to its last options.
  test('ends each list of options with one the page can always fill', () => {
    const lastPages = [
      ...entries.map(([, entry]) => pagesOf(entry).at(-1)).filter(Boolean),
      dropoutCopy.catchAll.legacyTemplate,
      dropoutCopy.catchAll.serviceTemplate
    ]
    for (const page of lastPages) {
      for (const templates of [page.title, page.body]) {
        expect(placeholders([templates].flat().at(-1)), page.title).toEqual([])
      }
    }
    expect(placeholders([dropoutCopy.names.feature].flat().at(-1))).toEqual([])
    expect(placeholders([dropoutCopy.names.habitat].flat().at(-1))).toEqual([])
  })

  test('shows every BNG Service template lineage error as its list, under its own heading', () => {
    const lineage = entries.filter(([code]) => code.startsWith('STAGED_'))

    expect(lineage.length).toBeGreaterThan(0)
    for (const [code, entry] of lineage) {
      expect(entry.singleProblemPage, code).toBeUndefined()
      expect(entry.problemsList?.heading, code).toBeTruthy()
    }
  })
})

describe('parseDropoutCopy', () => {
  test('reads the committed copy', () => {
    expect(parseDropoutCopy(COPY_SOURCE).errors.NO_REDLINE).toBeDefined()
  })

  test("reads an error's and a fallback's wording field", () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    expect(wordingStatus(copy.errors.IRREPLACEABLE_TREE)).toBe(
      WORDING_STATUS.INTERIM
    )
    expect(wordingStatus(copy.fileProblem)).toBe(WORDING_STATUS.INTERIM)
    expect(wordingStatus(copy.errors.NO_REDLINE)).toBe(WORDING_STATUS.FINAL)
  })

  test('accepts "none" on an error the page shows a shared fallback for', () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    const [code] = Object.entries(copy.errors).find(
      ([, entry]) => entry.singleProblemPage === SHARED_PAGE.FILE_PROBLEM
    )
    copy.errors[code].wording = 'none'

    expect(
      wordingStatus(parseDropoutCopy(JSON.stringify(copy)).errors[code])
    ).toBe(WORDING_STATUS.NONE)
  })

  test.each([
    [
      'an error with copy of its own',
      (copy) => copy.errors.NO_REDLINE,
      /NO_REDLINE\.wording/
    ],
    [
      'an error shown as its list',
      (copy) => copy.errors.IRREPLACEABLE_TREE,
      /IRREPLACEABLE_TREE\.wording/
    ],
    ['a shared fallback', (copy) => copy.fileProblem, /fileProblem\.wording/]
  ])('refuses "none" on %s, whose words are shown', (_, entryOf, message) => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    entryOf(copy).wording = 'none'

    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(message)
  })

  test('warns of a wording it does not know, rather than refusing the copy', () => {
    mockWarn.mockClear()
    const copy = parseDropoutCopy(COPY_SOURCE)
    copy.errors.NO_REDLINE.wording = 'pending'

    expect(() => parseDropoutCopy(JSON.stringify(copy))).not.toThrow()
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^error-text\.yaml: upload\.errors\.NO_REDLINE\.wording is "pending"/
      )
    )
  })

  // Each page is checked by its own sentence: NO_REDLINE, the file problem and
  // the catch-all share a title, so a reader that showed one for another would
  // pass a check of the title alone.
  test("shows an error's and a fallback's words whatever their wording field says", () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    copy.errors.NO_REDLINE.wording = 'pending'
    for (const fallback of [
      copy.fileProblem,
      copy.serviceProblem,
      copy.catchAll.legacyTemplate,
      copy.catchAll.serviceTemplate
    ]) {
      fallback.wording = 'pending'
    }
    const parsed = parseDropoutCopy(JSON.stringify(copy))
    const saved = { ...dropoutCopy }
    const serviceTemplate = config.get('serviceTemplate.enabled')
    config.set('serviceTemplate.enabled', false)
    Object.assign(dropoutCopy, {
      errors: parsed.errors,
      fileProblem: parsed.fileProblem,
      serviceProblem: parsed.serviceProblem,
      catchAll: parsed.catchAll
    })

    try {
      const page = (code) => resolveSingleErrorCopy({ code }, '/upload')
      expect(page('NO_REDLINE')).toMatchObject({
        h1: 'Your Geopackage (.gpkg) file contains an error',
        messageBefore:
          'The redline boundary is missing. Draw the red line boundary and '
      })
      expect(page('GPKG_RLB_UNREADABLE_GEOMETRY')).toMatchObject({
        h1: 'Your Geopackage (.gpkg) file contains an error',
        messageBefore: 'Check the habitats in your file and '
      })
      expect(page('FILENAME_TOO_LONG')).toMatchObject({
        h1: 'Your Geopackage (.gpkg) file contains an error',
        messageBefore:
          'The layer names and column names do not match what is required by Natural England. Rename the layers and columns and '
      })
      expect(page('SIZING_FAILED')).toMatchObject({
        h1: 'Sorry, there is a problem with the service',
        helpText: 'Try again later.'
      })
    } finally {
      Object.assign(dropoutCopy, saved)
      config.set('serviceTemplate.enabled', serviceTemplate)
    }
  })

  test('refuses an error with no problemsList', () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    delete copy.errors.NO_REDLINE.problemsList

    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(
      /NO_REDLINE.*problemsList/
    )
  })

  // A problem lists habitats or not, however it is worded, so its bullets
  // and its variants' are of one kind.
  test.each([
    [
      'the code',
      'GPKG_MISSING_LAYER',
      (problemsList) => (problemsList.item = '{feature}')
    ],
    [
      'a variant',
      'GPKG_BASELINE_SRS_ID',
      (problemsList) => (problemsList.variants.contents.item = '{feature}')
    ],
    [
      "a variant, beside the code's detail",
      'GPKG_BASELINE_MISSING_COLUMN',
      (problemsList) => {
        problemsList.variants.geometry = { item: '{feature}' }
      }
    ],
    [
      "a variant, beside the code's item",
      'AREA_PARCELS_INVALID_GEOMETRY',
      (problemsList) => {
        problemsList.variants = { odd: { detail: '{layer}' } }
      }
    ]
  ])('refuses an item and a detail in %s', (_, code, mix) => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    mix(copy.errors[code].problemsList)

    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(
      new RegExp(`errors\\.${code}\\.problemsList`)
    )
  })

  test('refuses a singleProblemPage that is neither copy nor a known keyword', () => {
    const broken = COPY_SOURCE.replace(
      / {4}singleProblemPage: catch-all\n/,
      '    singleProblemPage: catchall\n'
    )

    expect(() => parseDropoutCopy(broken)).toThrow(/not valid/)
  })

  test.each([
    ['page', 'listHeading'],
    ['page', 'uploadButton'],
    ['unknown', 'location']
  ])('refuses copy with no %s.%s, which the page reads', (section, key) => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    delete copy[section][key]

    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(
      new RegExp(`${section}\\.${key}.*required`)
    )
  })

  test('keeps the space that starts a bullet part', () => {
    expect(
      parseDropoutCopy(COPY_SOURCE).errors.AREA_PARCELS_INVALID_GEOMETRY
        .problemsList.item
    ).toEqual(['{feature}', ' ({reason})'])
  })
})

describe('fill, firstKnown and joinKnownParts', () => {
  test('fill puts each value in its place, and nothing for one not given', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and ')
  })

  test('firstKnown takes the first option whose values are all known', () => {
    const options = ['Parcel {ref}', 'A parcel']

    expect(firstKnown(options, { ref: 'H1' })).toBe('Parcel H1')
    expect(firstKnown(options, { ref: '' })).toBe('A parcel')
    expect(firstKnown('Only {ref}', {})).toBe('Only ')
  })

  test('canFill says whether any option can be filled', () => {
    expect(canFill(['{a}', '{b}'], { b: 0 })).toBe(true)
    expect(canFill('{a}', {})).toBe(false)
  })

  test('joinKnownParts drops each part with a value missing', () => {
    expect(
      joinKnownParts(['{name}', ' — {type}', ', copied to {refs}'], {
        name: 'H1',
        refs: 'H2, H3'
      })
    ).toBe('H1, copied to H2, H3')
  })
})

describe('splitLink', () => {
  test('splits a sentence at its link', () => {
    expect(splitLink('Draw it and [upload a new file](upload).')).toEqual({
      before: 'Draw it and ',
      linkText: 'upload a new file',
      target: 'upload',
      after: '.'
    })
  })

  test('gives a sentence with no link whole', () => {
    expect(splitLink('Nothing to do.')).toEqual({ before: 'Nothing to do.' })
  })

  test('gives a sentence whole when its brackets are not a link', () => {
    expect(splitLink('A [note] (aside).')).toEqual({
      before: 'A [note] (aside).'
    })
    expect(splitLink('A [link](unclosed.')).toEqual({
      before: 'A [link](unclosed.'
    })
  })
})

describe('pageText', () => {
  test('fills in the stage and the count the page names', () => {
    const page = pageText({ fileLabel: 'baseline' })

    expect(page.listHeading).toBe("We couldn't accept your baseline file")
    expect(page.more(3)).toBe('… and 3 more')
    expect(page.uploadButton).toBe('Upload a different file')
  })
})

describe('errorCopy', () => {
  test('gives nothing for a code the copy does not know', () => {
    expect(errorCopy('NOT_A_CODE')).toBeNull()
    expect(errorCopy(undefined)).toBeNull()
  })

  test('gives no heading where the list shows the catch-all title', () => {
    expect(errorCopy('INVALID_FILENAME').problemsList).toBe('catch-all')
  })
})

describe('singleProblemPages', () => {
  const error = (code, count) => ({ code, details: { count } })

  test('gives a code with no entry the file problem page', () => {
    expect(singleProblemPages(error('NOT_A_CODE', 1))).toBe(
      dropoutCopy.fileProblem
    )
  })

  test('gives the shared page a singleProblemPage names, for any count', () => {
    const [code, entry] = Object.entries(dropoutCopy.errors).find(
      ([, e]) => e.singleProblemPage === SHARED_PAGE.CATCH_ALL
    )
    expect(singleProblemPages(error(code, 5))).toBe(
      sharedPage(entry.singleProblemPage)
    )
  })

  test('gives no page to an error with no singleProblemPage', () => {
    expect(
      singleProblemPages(error('TEMPLATE_VERSION_DUPLICATED', 1))
    ).toBeNull()
  })

  test('gives a page worded for any number for any count', () => {
    const page = errorCopy(
      'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE'
    ).singleProblemPage
    expect(
      singleProblemPages(error('HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', 4))
    ).toBe(page)
  })

  test('gives one for one habitat, or none, and no page for several with only one', () => {
    const { one } = errorCopy('AREA_PARCELS_TOO_SMALL').singleProblemPage
    expect(singleProblemPages(error('AREA_PARCELS_TOO_SMALL', 1))).toBe(one)
    expect(singleProblemPages({ code: 'AREA_PARCELS_TOO_SMALL' })).toBe(one)
    expect(singleProblemPages(error('AREA_PARCELS_TOO_SMALL', 2))).toBeNull()
  })

  test('gives several for several habitats when the entry has it', () => {
    const { several } = errorCopy('PARCEL_OVERLAPS').singleProblemPage
    expect(singleProblemPages(error('PARCEL_OVERLAPS', 2))).toBe(several)
  })
})

describe('parseDropoutCopy, singleProblemPage for one and several', () => {
  const withPage = (singleProblemPage) => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    copy.errors.NO_REDLINE.singleProblemPage = singleProblemPage
    return JSON.stringify(copy)
  }
  const page = { title: 'A title', body: 'A body.' }

  test('accepts one alone, and one with several', () => {
    expect(() => parseDropoutCopy(withPage({ one: page }))).not.toThrow()
    expect(() =>
      parseDropoutCopy(withPage({ one: page, several: [page, page] }))
    ).not.toThrow()
  })

  test('refuses several with no one', () => {
    expect(() => parseDropoutCopy(withPage({ several: page }))).toThrow(
      /NO_REDLINE\.singleProblemPage/
    )
  })

  test('refuses "none" on an error with no single-problem page, whose words are always shown', () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    delete copy.errors.NO_REDLINE.singleProblemPage
    copy.errors.NO_REDLINE.wording = 'none'
    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(
      /NO_REDLINE\.wording/
    )
  })
})

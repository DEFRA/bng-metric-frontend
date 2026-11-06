import { dump } from 'js-yaml'
import { describe, test, expect } from 'vitest'

import { errorText } from '../common/error-text/error-text.js'

import {
  LINK_TARGETS,
  PAGE_TEXT_VALUES,
  WHEN_ALONE,
  canFill,
  dropoutCopy,
  errorCopy,
  fill,
  firstKnown,
  joinKnownParts,
  listHeading,
  pageText,
  parseDropoutCopy,
  splitLink
} from './dropout-copy.js'
import { NOTE_VALUE_NAMES, itemValueNames } from './controller.js'
import { PLACEHOLDER_VALUE_NAMES, pageValueNames } from './single-error-copy.js'

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

function pagesOf(entry) {
  return typeof entry.whenAlone === 'object' ? [entry.whenAlone].flat() : []
}

const allPages = [
  ...entries.flatMap(([, entry]) => pagesOf(entry)),
  dropoutCopy.catchAll.legacyTemplate,
  dropoutCopy.catchAll.serviceTemplate
]

describe("error-text.yaml's upload section", () => {
  test('gives every error both layouts', () => {
    for (const [code, entry] of entries) {
      expect(entry.whenAlone, code).toBeDefined()
      expect(entry.inList, code).toBeDefined()
    }
  })

  test('names only the {values} the page fills in', () => {
    for (const page of allPages) {
      for (const name of placeholders([page.title, page.body].flat())) {
        expect(pageValueNames(), `${page.title}: {${name}}`).toContain(name)
      }
    }
    // Each code's bullets against the values the code supplies for that code,
    // so {location} on a lineage bullet fails even though another code has it.
    for (const [code, { inList }] of entries) {
      for (const name of placeholders(inList.item ?? [])) {
        expect(itemValueNames(code), `${code}: {${name}}`).toContain(name)
      }
    }
    for (const name of placeholders([
      ...[dropoutCopy.names.feature].flat(),
      ...[dropoutCopy.names.habitat].flat()
    ])) {
      expect(NAME_VALUES, `{${name}}`).toContain(name)
    }
  })

  // The page's own strings, list notes and headings, and the placeholder copy:
  // each is filled with its own few values, or none, so a typo such as
  // {Count} would otherwise leave a blank on every page.
  test('names only the {values} each page string, note, heading and placeholder is filled with', () => {
    for (const [key, value] of Object.entries(dropoutCopy.page)) {
      for (const name of placeholders(value)) {
        expect(PAGE_TEXT_VALUES[key] ?? [], `page.${key}: {${name}}`).toContain(
          name
        )
      }
    }
    for (const [code, { inList }] of entries) {
      for (const name of placeholders(inList.note ?? [])) {
        expect(NOTE_VALUE_NAMES, `${code} note: {${name}}`).toContain(name)
      }
      expect(placeholders(inList.heading ?? []), `${code} heading`).toEqual([])
    }
    const { title, body } = dropoutCopy.placeholder
    for (const name of placeholders([title, body].flat())) {
      expect(PLACEHOLDER_VALUE_NAMES, `placeholder: {${name}}`).toContain(name)
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
      expect(entry.whenAlone, code).toBe(WHEN_ALONE.LIST)
      expect(listHeading(code), code).toBeTruthy()
    }
  })
})

describe('parseDropoutCopy', () => {
  test('reads the committed copy', () => {
    expect(parseDropoutCopy(COPY_SOURCE).errors.NO_REDLINE).toBeDefined()
  })

  test('refuses an error with no inList', () => {
    const copy = parseDropoutCopy(COPY_SOURCE)
    delete copy.errors.NO_REDLINE.inList

    expect(() => parseDropoutCopy(JSON.stringify(copy))).toThrow(
      /NO_REDLINE.*inList/
    )
  })

  test('refuses a whenAlone that is neither copy nor a known keyword', () => {
    const broken = COPY_SOURCE.replace(
      / {4}whenAlone: catch-all\n/,
      '    whenAlone: catchall\n'
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
      parseDropoutCopy(COPY_SOURCE).errors.AREA_PARCELS_INVALID_GEOMETRY.inList
        .item
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

describe('errorCopy and listHeading', () => {
  test('give nothing for a code the copy does not know', () => {
    expect(errorCopy('NOT_A_CODE')).toBeNull()
    expect(errorCopy(undefined)).toBeNull()
    expect(listHeading('NOT_A_CODE')).toBeNull()
  })

  test('give no heading where the list shows the service message', () => {
    expect(listHeading('NO_REDLINE')).toBeNull()
  })
})

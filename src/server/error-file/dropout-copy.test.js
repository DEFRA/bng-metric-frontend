import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, test, expect } from 'vitest'

import {
  LINK_TARGETS,
  WHEN_ALONE,
  canFill,
  dropoutCopy,
  errorCopy,
  fill,
  firstKnown,
  joinKnownParts,
  listHeading,
  parseDropoutCopy,
  splitLink
} from './dropout-copy.js'

const COPY_SOURCE = readFileSync(
  path.join(import.meta.dirname, 'dropout-copy.yaml'),
  'utf8'
)

// The {values} the code fills in, by where they appear. A name outside these
// would be left blank on the page, so a typo such as {Ref} fails here.
const PAGE_VALUES = new Set([
  'ref',
  'refA',
  'refB',
  'featureCount',
  'maxFeatureCount'
])
const ITEM_VALUES = new Set([
  'feature',
  'featureA',
  'featureB',
  'reason',
  'condition',
  'area',
  'location',
  'habitatType',
  'distinctiveness',
  'table',
  'name',
  'parentRef',
  'childRefs',
  'length',
  'childLength',
  'childArea'
])
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

describe('dropout-copy.yaml', () => {
  test('gives every error where its copy came from and both layouts', () => {
    for (const [code, entry] of entries) {
      expect(entry.copyFrom, code).toBeTruthy()
      expect(entry.whenAlone, code).toBeDefined()
      expect(entry.inList, code).toBeDefined()
    }
  })

  test('names only the {values} the page fills in', () => {
    for (const page of allPages) {
      for (const name of placeholders([page.title, page.body].flat())) {
        expect(PAGE_VALUES, `${page.title}: {${name}}`).toContain(name)
      }
    }
    for (const [code, { inList }] of entries) {
      for (const name of placeholders(inList.item ?? [])) {
        expect(ITEM_VALUES, `${code}: {${name}}`).toContain(name)
      }
    }
    for (const name of placeholders([
      ...[dropoutCopy.names.feature].flat(),
      ...[dropoutCopy.names.habitat].flat()
    ])) {
      expect(NAME_VALUES, `{${name}}`).toContain(name)
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

  test('refuses an error with no copyFrom', () => {
    const broken = COPY_SOURCE.replace(
      /( {2}NO_REDLINE:\n) {4}copyFrom: [^\n]+\n/,
      '$1'
    )

    expect(() => parseDropoutCopy(broken)).toThrow(/NO_REDLINE.*copyFrom/)
  })

  test('refuses a whenAlone that is neither copy nor a known keyword', () => {
    const broken = COPY_SOURCE.replace(
      / {4}whenAlone: catch-all\n/,
      '    whenAlone: catchall\n'
    )

    expect(() => parseDropoutCopy(broken)).toThrow(/not valid/)
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

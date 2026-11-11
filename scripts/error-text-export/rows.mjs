import {
  WORDING_STATUS,
  wordingStatus
} from '../../src/server/common/error-text/wording.js'
import {
  PROBLEMS_LIST_CATCH_ALL,
  SHARED_PAGE
} from '../../src/server/error-file/dropout-copy.js'
import {
  ENTRY_PLACEHOLDERS,
  LINK_TARGET_NAMES,
  PLACEHOLDERS
} from './placeholders.mjs'
import { readErrorTextSource } from './read.mjs'

// error-text.yaml as rows, one for each error ID, for product, BAs and UCD to
// review its messages in one table. No I/O: each writer takes these rows and
// COLUMNS as they are, so the three formats hold the same content.
//
// An ID is the backend's code for a drop-out page or edit error, so a code
// met in both is one row, and the entry's dotted place in the file for
// anything else. By default only the codes are given: see ROW_GROUPS. An
// error with no words of its own shows a shared fallback's, so its row
// repeats them and names the fallback, which can have a row of its own.

/** How far an error's wording has got, as the Status column says it. */
export const STATUS = Object.freeze({
  NEEDS_CONTENT: 'Needs content',
  AWAITING_UCD: 'Awaiting UCD',
  FINAL: 'Final'
})

const STATUS_OF = Object.freeze({
  [WORDING_STATUS.NONE]: STATUS.NEEDS_CONTENT,
  [WORDING_STATUS.INTERIM]: STATUS.AWAITING_UCD,
  [WORDING_STATUS.FINAL]: STATUS.FINAL
})

// Least finished first: a row made of two entries is as far on as the less
// finished of them.
const STATUS_ORDER = [STATUS.NEEDS_CONTENT, STATUS.AWAITING_UCD, STATUS.FINAL]

/** Every column, in order, with its width in characters for the .xlsx. */
export const COLUMNS = Object.freeze([
  { key: 'id', header: 'Error ID', width: 36 },
  { key: 'shown', header: 'Where it is shown', width: 20 },
  { key: 'alone', header: 'When it is the only problem', width: 36 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'summary', header: 'Error summary', width: 40 },
  { key: 'inline', header: 'Inline message', width: 40 },
  { key: 'pageHeading', header: 'Page heading', width: 40 },
  { key: 'subheading', header: 'Subheading', width: 18 },
  { key: 'body', header: 'Body', width: 60 },
  { key: 'pageHeadingSeveral', header: 'Page heading (several)', width: 40 },
  { key: 'subheadingSeveral', header: 'Subheading (several)', width: 18 },
  { key: 'bodySeveral', header: 'Body (several)', width: 60 },
  { key: 'listHeading', header: 'List heading', width: 60 },
  { key: 'item', header: 'Item', width: 40 },
  { key: 'detail', header: 'Detail', width: 40 },
  { key: 'listNote', header: 'List note', width: 30 },
  { key: 'text', header: 'Text', width: 50 },
  { key: 'fallback', header: 'Shared fallback', width: 40 },
  { key: 'values', header: 'Values it fills in', width: 60 },
  { key: 'links', header: 'Links', width: 40 },
  { key: 'source', header: 'Source', width: 50 }
])

// The columns that hold words a customer sees.
export const WORDING_KEYS = Object.freeze([
  'summary',
  'inline',
  'pageHeading',
  'subheading',
  'body',
  'pageHeadingSeveral',
  'subheadingSeveral',
  'bodySeveral',
  'listHeading',
  'item',
  'detail',
  'listNote',
  'text'
])

/** Where a customer meets an entry, as the Where it is shown column says. */
export const SHOWN = Object.freeze({
  COMMON: 'Every page',
  UPLOAD: 'Drop-out page',
  FALLBACK: 'Drop-out page, in place of an error’s own words',
  EDIT: 'Edit made on screen',
  FORM: 'Form',
  PAGE: 'Whole page'
})

/**
 * What a drop-out page error shows when it is the file's only problem, as
 * the When it is the only problem column says: from its singleProblemPage.
 */
export const ALONE = Object.freeze({
  OWN: 'Its own page, worded for any number of habitats',
  OWN_ONE_AND_SEVERAL: 'Its own page, worded for one habitat and for several',
  OWN_ONE_ONLY:
    'Its own page for one habitat; the problems list for several, until it has wording for several',
  SHARED: 'A shared page, named in Shared fallback',
  PROBLEMS_LIST: 'The problems list'
})

/**
 * The kinds of row the file gives, by the part of it they come from. The
 * export gives DEFAULT_GROUPS; any other can be given back, with --include
 * or buildRows' `groups`, without changing how its rows are built.
 */
export const ROW_GROUPS = Object.freeze({
  /** The backend's error codes, such as VALIDATION_UNAVAILABLE: upload.errors and edit. */
  CODES: 'codes',
  /** The drop-out page's shared fallbacks, such as upload.catchAll. */
  FALLBACKS: 'fallbacks',
  /** The drop-out page's other words, such as upload.page.title. */
  UPLOAD_TEXT: 'upload-text',
  /** common.*: what every page falls back to. */
  COMMON: 'common',
  /** forms.*: each form check's message. */
  FORMS: 'forms',
  /** pages.*: whole error pages. */
  PAGES: 'pages'
})

/** Every group, in the order a full export lists them. */
export const ALL_GROUPS = Object.freeze(Object.values(ROW_GROUPS))

/**
 * What the export gives unless told otherwise: the error codes alone. The
 * rest made the export too long to review; a code that shows a shared
 * fallback still names it and repeats its words.
 */
export const DEFAULT_GROUPS = Object.freeze([ROW_GROUPS.CODES])

/** Said of a {name} or link target that placeholders.mjs does not explain. */
export const NOT_EXPLAINED = 'not explained yet'

/** The upload section's shared fallbacks, by the name singleProblemPage gives them. */
export const FALLBACKS = Object.freeze({
  [SHARED_PAGE.CATCH_ALL]: {
    key: 'catchAll',
    label: 'Catch-all',
    // The service-template flag decides which the page shows.
    templates: [
      ['legacyTemplate', 'Legacy template'],
      ['serviceTemplate', 'BNG Service template']
    ]
  },
  [SHARED_PAGE.FILE_PROBLEM]: { key: 'fileProblem', label: 'File problem' },
  [SHARED_PAGE.SERVICE_PROBLEM]: {
    key: 'serviceProblem',
    label: 'Service problem'
  }
})

const UNWORDED_EDIT =
  'None yet: the page shows its generic error for a refused change'

const OTHERWISE = '\nOtherwise: '
const PLACEHOLDER = /\{(\w+)\}/g
const LINK = /\[[^\]]+\]\(([^)]+)\)/g

/** A list of options, the first whose values are known, as one text. */
function optionsText(options) {
  return [options].flat().join(OTHERWISE)
}

/** A bullet given as parts, each shown when its values are known. */
function partsText(parts) {
  return [parts].flat().join('')
}

/** Words given alone, or as `text` beside a `wording` field. */
function wordsOf(entry) {
  return typeof entry === 'string' ? entry : entry.text
}

function statusOf(entry) {
  return STATUS_OF[wordingStatus(entry)]
}

/** One text for what each copy says, labelled by copy when they differ. */
function sameOrLabelled(labelled) {
  const texts = labelled.filter(([, text]) => text !== undefined)
  if (texts.length === 0) {
    return undefined
  }
  const distinct = new Set(texts.map(([, text]) => text))
  return distinct.size === 1
    ? texts[0][1]
    : texts.map(([label, text]) => `${label}: ${text}`).join('\n')
}

/**
 * A key of an upload error's problemsList, with each variant that rewords it:
 * "bng-service variant: …".
 */
function withVariants(problemsList, key, render) {
  const own = problemsList[key] === undefined ? [] : [render(problemsList[key])]
  const variants = Object.entries(problemsList.variants ?? {})
    .filter(([, variant]) => variant[key] !== undefined)
    .map(([name, variant]) => `${name} variant: ${render(variant[key])}`)
  return variants.length > 0 || own.length > 0
    ? [...own, ...variants].join('\n')
    : undefined
}

/** A single-problem page's words: one page copy, or options of them. */
function pageCopyCells(copies) {
  const list = [copies].flat()
  const join = (key) => {
    const texts = list
      .map((copy) => copy[key])
      .filter((text) => text !== undefined)
      .map(optionsText)
    return texts.length > 0 ? texts.join(OTHERWISE) : undefined
  }
  return {
    pageHeading: join('title'),
    subheading: join('subheading'),
    body: join('body')
  }
}

function newRow(id, shown, entry, path) {
  return {
    id,
    shown: [shown],
    statuses: [statusOf(entry)],
    cells: {},
    paths: [path],
    fallbacks: []
  }
}

function commonRows({ common }) {
  return Object.entries(common).map(([key, entry]) => {
    const row = newRow(`common.${key}`, SHOWN.COMMON, entry, ['common', key])
    row.cells.text = wordsOf(entry)
    return row
  })
}

/** The upload section's strings that are not an error's: page, names and so on. */
function uploadTextRows({ upload }) {
  return ['page', 'names', 'unknown', 'distinctiveness', 'layers'].flatMap(
    (group) =>
      Object.entries(upload[group] ?? {}).map(([key, text]) => {
        const row = newRow(`upload.${group}.${key}`, SHOWN.UPLOAD, text, [
          'upload',
          group,
          key
        ])
        row.cells.text = optionsText(text)
        return row
      })
  )
}

/** The copies a fallback has: one per template for the catch-all. */
function fallbackCopies(upload, fallback) {
  const copy = upload[fallback.key]
  return fallback.templates
    ? fallback.templates.map(([key, label]) => ({
        label,
        copy: copy[key],
        path: ['upload', fallback.key, key]
      }))
    : [{ label: fallback.label, copy, path: ['upload', fallback.key] }]
}

function fallbackCells(upload, fallback) {
  const copies = fallbackCopies(upload, fallback)
  const cell = (key) =>
    sameOrLabelled(copies.map(({ label, copy }) => [label, copy[key]]))
  return {
    pageHeading: cell('title'),
    subheading: cell('subheading'),
    body: cell('body')
  }
}

function fallbackName(fallback) {
  return `${fallback.label} (upload.${fallback.key})`
}

/** The status of each copy of a fallback, as words a row repeats. */
function fallbackStatuses(upload, fallback) {
  return fallbackCopies(upload, fallback).map(({ copy }) => statusOf(copy))
}

/** The words of a single-problem page worded for several, in their own columns. */
function severalCells(copies) {
  const { pageHeading, subheading, body } = pageCopyCells(copies)
  return {
    pageHeadingSeveral: pageHeading,
    subheadingSeveral: subheading,
    bodySeveral: body
  }
}

/**
 * An upload error's single-problem page: its words, and what the When it is
 * the only problem column says of it.
 */
function singleProblemCells(page) {
  if (page === undefined) {
    return { alone: ALONE.PROBLEMS_LIST, cells: {} }
  }
  if (!Object.hasOwn(page, 'one')) {
    return { alone: ALONE.OWN, cells: pageCopyCells(page) }
  }
  return page.several === undefined
    ? { alone: ALONE.OWN_ONE_ONLY, cells: pageCopyCells(page.one) }
    : {
        alone: ALONE.OWN_ONE_AND_SEVERAL,
        cells: { ...pageCopyCells(page.one), ...severalCells(page.several) }
      }
}

/**
 * An upload error's row, noting in `usage` each fallback it shows. A row
 * repeating a fallback's words is no further on than that fallback.
 */
function uploadErrorRow(upload, code, entry, usage) {
  const { singleProblemPage, problemsList } = entry
  const row = newRow(code, SHOWN.UPLOAD, entry, ['upload', 'errors', code])

  if (typeof singleProblemPage === 'string') {
    const fallback = FALLBACKS[singleProblemPage]
    row.alone = ALONE.SHARED
    Object.assign(row.cells, fallbackCells(upload, fallback))
    row.statuses.push(...fallbackStatuses(upload, fallback))
    row.fallbacks.push(`${fallbackName(fallback)}, when alone`)
    usage[singleProblemPage].alone.push(code)
  } else {
    const { alone, cells } = singleProblemCells(singleProblemPage)
    row.alone = alone
    Object.assign(row.cells, cells)
  }

  if (problemsList === PROBLEMS_LIST_CATCH_ALL) {
    const fallback = FALLBACKS[SHARED_PAGE.CATCH_ALL]
    row.cells.listHeading = fallbackCells(upload, fallback).pageHeading
    row.statuses.push(...fallbackStatuses(upload, fallback))
    row.fallbacks.push(`${fallbackName(fallback)} title, in a list`)
    usage[SHARED_PAGE.CATCH_ALL].listed.push(code)
  } else {
    Object.assign(row.cells, {
      listHeading: withVariants(problemsList, 'heading', String),
      item: withVariants(problemsList, 'item', partsText),
      detail: withVariants(problemsList, 'detail', partsText),
      listNote: problemsList.note
    })
    row.partsNote = [
      problemsList,
      ...Object.values(problemsList.variants ?? {})
    ].some(({ item, detail }) => Array.isArray(item) || Array.isArray(detail))
  }
  return row
}

function usedBy(codes, when) {
  return codes.length > 0
    ? [`${when} by ${codes.length}: ${codes.join(', ')}`]
    : []
}

function fallbackRows(upload, usage) {
  return Object.entries(FALLBACKS).map(([name, fallback]) => {
    const row = {
      id: `upload.${fallback.key}`,
      shown: [SHOWN.FALLBACK],
      statuses: fallbackStatuses(upload, fallback),
      cells: fallbackCells(upload, fallback),
      paths: [['upload', fallback.key]],
      fallbacks: [
        ...usedBy(usage[name].alone, 'Shown alone'),
        ...usedBy(usage[name].listed, 'Its title heads a list')
      ]
    }
    return row
  })
}

function editRow(code, entry) {
  const row = newRow(code, SHOWN.EDIT, entry, ['edit', code])
  // A refusal no one field can put right is shown in the error summary only.
  row.cells.summary = entry.summary ?? entry.summaryOnly
  row.cells.inline = entry.inline
  if (row.cells.summary === undefined) {
    row.fallbacks.push(UNWORDED_EDIT)
  }
  return row
}

/** A code met on the drop-out page and on an edit: one row for both. */
function merge(upload, edit) {
  return {
    ...upload,
    shown: [...upload.shown, ...edit.shown],
    statuses: [...upload.statuses, ...edit.statuses],
    cells: {
      ...upload.cells,
      summary: edit.cells.summary,
      inline: edit.cells.inline
    },
    paths: [...upload.paths, ...edit.paths],
    fallbacks: [
      ...upload.fallbacks,
      ...edit.fallbacks.map((fallback) => `${SHOWN.EDIT}: ${fallback}`)
    ]
  }
}

function uploadAndEditRows(value) {
  const { upload, edit } = value
  const usage = Object.fromEntries(
    Object.keys(FALLBACKS).map((name) => [name, { alone: [], listed: [] }])
  )
  const edits = new Map(
    Object.entries(edit).map(([code, entry]) => [code, editRow(code, entry)])
  )
  const errors = Object.entries(upload.errors).map(([code, entry]) => {
    const row = uploadErrorRow(upload, code, entry, usage)
    const met = edits.get(code)
    edits.delete(code)
    return met ? merge(row, met) : row
  })
  return {
    codes: [...errors, ...edits.values()],
    fallbacks: fallbackRows(upload, usage)
  }
}

function formRows({ forms, common }) {
  return Object.entries(forms).flatMap(([field, rules]) =>
    Object.entries(rules).map(([rule, entry]) => {
      const row = newRow(`forms.${field}.${rule}`, SHOWN.FORM, entry, [
        'forms',
        field,
        rule
      ])
      if (typeof entry === 'string' || entry.text) {
        row.cells.summary = wordsOf(entry)
        row.cells.inline = wordsOf(entry)
      } else if (entry.summary) {
        row.cells.summary = entry.summary
        row.cells.inline = entry.inline
      } else {
        row.cells.summary = wordsOf(common.unworded)
        row.cells.inline = wordsOf(common.unworded)
        row.fallbacks.push('common.unworded')
      }
      return row
    })
  )
}

function pageRows({ pages }) {
  return Object.entries(pages).map(([key, page]) => {
    const row = newRow(`pages.${key}`, SHOWN.PAGE, page, ['pages', key])
    row.cells.pageHeading = page.title
    row.cells.body = page.body?.join('\n')
    return row
  })
}

function unique(values) {
  return [...new Set(values)]
}

function valuesText(row, words) {
  const names = unique(
    words.flatMap((text) =>
      [...text.matchAll(PLACEHOLDER)].map(([, name]) => name)
    )
  )
  const lines = names.map((name) => {
    const meaning =
      ENTRY_PLACEHOLDERS[row.id]?.[name] ?? PLACEHOLDERS[name] ?? NOT_EXPLAINED
    return `{${name}}: ${meaning}`
  })
  if (row.partsNote) {
    lines.push(
      'A part of a bullet is left out when any of its values is not known.'
    )
  }
  return lines.join('\n')
}

function linksText(words, value) {
  const targets = unique(
    words.flatMap((text) =>
      [...text.matchAll(LINK)].map(([, target]) => target)
    )
  )
  return targets
    .map((target) => {
      const name = LINK_TARGET_NAMES[target] ?? NOT_EXPLAINED
      const url = value.upload.links[target]
      return url ? `${target}: ${name}, ${url}` : `${target}: ${name}`
    })
    .join('\n')
}

function finish(row, file, sourceUrl) {
  const words = WORDING_KEYS.map((key) => row.cells[key]).filter(Boolean)
  const status = STATUS_ORDER.find((s) => row.statuses.includes(s))
  const cells = Object.fromEntries(
    WORDING_KEYS.map((key) => [key, row.cells[key] ?? ''])
  )
  return {
    id: row.id,
    shown: unique(row.shown).join('; '),
    alone: row.alone ?? '',
    status,
    ...cells,
    fallback: row.fallbacks.join('\n'),
    values: valuesText(row, words),
    links: linksText(words, file.value),
    source: row.paths.map((path) => sourceUrl(file.lineOf(path))).join('\n')
  }
}

/** Sort by error ID, ignoring case. */
function byId(a, b) {
  return a.id.localeCompare(b.id, 'en', { sensitivity: 'base' })
}

/**
 * Refuse a group buildRows does not know, naming those it does.
 *
 * @param {string[]} groups
 */
export function checkGroups(groups) {
  const unknown = groups.filter((group) => !ALL_GROUPS.includes(group))
  if (unknown.length > 0) {
    throw new Error(
      `Unknown row group ${unknown.join(', ')}: choose from ${ALL_GROUPS.join(', ')}`
    )
  }
}

/** Each group's rows, before they are finished. */
function rowsByGroup(value) {
  const { codes, fallbacks } = uploadAndEditRows(value)
  return {
    [ROW_GROUPS.CODES]: codes,
    [ROW_GROUPS.FALLBACKS]: fallbacks,
    [ROW_GROUPS.UPLOAD_TEXT]: uploadTextRows(value),
    [ROW_GROUPS.COMMON]: commonRows(value),
    [ROW_GROUPS.FORMS]: formRows(value),
    [ROW_GROUPS.PAGES]: pageRows(value)
  }
}

/**
 * error-text.yaml's rows, sorted by error ID.
 *
 * @param {string} source - error-text.yaml's text
 * @param {{ sourceUrl?: (line: number) => string, groups?: readonly string[] }} [options]
 *   sourceUrl: the link to a line of the file, by default its line anchor
 *   alone; groups: which of ROW_GROUPS to give, by default DEFAULT_GROUPS
 * @returns {Array<Record<string, string>>} a row has a value for each of COLUMNS' keys
 */
export function buildRows(
  source,
  { sourceUrl = (line) => `#L${line}`, groups = DEFAULT_GROUPS } = {}
) {
  checkGroups(groups)
  const file = readErrorTextSource(source)
  const byGroup = rowsByGroup(file.value)
  return unique(groups)
    .flatMap((group) => byGroup[group])
    .map((row) => finish(row, file, sourceUrl))
    .sort(byId)
}

/**
 * How many rows have each status.
 *
 * @param {Array<{ status: string }>} rows
 * @returns {Record<string, number>}
 */
export function statusCounts(rows) {
  return Object.fromEntries(
    STATUS_ORDER.map((status) => [
      status,
      rows.filter((row) => row.status === status).length
    ])
  )
}

import {
  WORDING_STATUS,
  wordingStatus
} from '../../src/server/common/error-text/wording.js'
import {
  ENTRY_PLACEHOLDERS,
  LINK_TARGET_NAMES,
  PLACEHOLDERS
} from './placeholders.mjs'
import { readErrorTextSource } from './read.mjs'

// error-text.yaml as rows, one for each error ID, for product, BAs and UCD to
// review every message in one table. No I/O: each writer takes these rows and
// COLUMNS as they are, so the three formats hold the same content.
//
// An ID is the backend's code for a drop-out page or edit error, so a code
// met in both is one row, and the entry's dotted place in the file for
// anything else. An error with no words of its own shows a shared fallback's,
// so its row repeats them and names the fallback, which has a row of its own.

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
  { key: 'status', header: 'Status', width: 14 },
  { key: 'summary', header: 'Error summary', width: 40 },
  { key: 'inline', header: 'Inline message', width: 40 },
  { key: 'pageHeading', header: 'Page heading', width: 40 },
  { key: 'subheading', header: 'Subheading', width: 18 },
  { key: 'body', header: 'Body', width: 60 },
  { key: 'listHeading', header: 'List heading', width: 60 },
  { key: 'item', header: 'Item', width: 40 },
  { key: 'detail', header: 'Detail', width: 40 },
  { key: 'listNote', header: 'List note', width: 30 },
  { key: 'text', header: 'Text', width: 50 },
  { key: 'fallback', header: 'Shared fallback', width: 40 },
  { key: 'values', header: 'Values it fills in', width: 60 },
  { key: 'links', header: 'Links', width: 40 },
  { key: 'comments', header: 'Comments in the file', width: 60 },
  { key: 'source', header: 'Source', width: 50 }
])

// The columns that hold words a customer sees.
const WORDING_KEYS = [
  'summary',
  'inline',
  'pageHeading',
  'subheading',
  'body',
  'listHeading',
  'item',
  'detail',
  'listNote',
  'text'
]

/** Where a customer meets an entry, as the Where it is shown column says. */
export const SHOWN = Object.freeze({
  COMMON: 'Every page',
  UPLOAD: 'Drop-out page',
  UPLOAD_AS_LIST: 'Drop-out page, always as a list',
  FALLBACK: 'Drop-out page, in place of an error’s own words',
  EDIT: 'Edit made on screen',
  FORM: 'Form',
  PAGE: 'Whole page'
})

/** Said of a {name} or link target that placeholders.mjs does not explain. */
export const NOT_EXPLAINED = 'not explained yet'

// What an upload error's whenAlone or inList can name in place of words.
const WHEN_ALONE_LIST = 'list'
const CATCH_ALL = 'catch-all'

/** The upload section's shared fallbacks, by the name whenAlone gives them. */
const FALLBACKS = Object.freeze({
  [CATCH_ALL]: {
    key: 'catchAll',
    label: 'Catch-all',
    // The service-template flag decides which the page shows.
    templates: [
      ['legacyTemplate', 'Legacy template'],
      ['serviceTemplate', 'BNG Service template']
    ]
  },
  'file-problem': { key: 'fileProblem', label: 'File problem' },
  'service-problem': { key: 'serviceProblem', label: 'Service problem' }
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
 * A key of an upload error's inList, with each variant that rewords it:
 * "bng-service variant: …".
 */
function withVariants(inList, key, render) {
  const own = inList[key] === undefined ? [] : [render(inList[key])]
  const variants = Object.entries(inList.variants ?? {})
    .filter(([, variant]) => variant[key] !== undefined)
    .map(([name, variant]) => `${name} variant: ${render(variant[key])}`)
  return variants.length > 0 || own.length > 0
    ? [...own, ...variants].join('\n')
    : undefined
}

/** A drop-out page layout's words: one page copy, or options of them. */
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
  return ['page', 'names', 'unknown', 'distinctiveness'].flatMap((group) =>
    Object.entries(upload[group]).map(([key, text]) => {
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

/** An upload error's row, noting in `usage` each fallback it shows. */
function uploadErrorRow(upload, code, entry, usage) {
  const { whenAlone, inList } = entry
  const row = newRow(code, SHOWN.UPLOAD, entry, ['upload', 'errors', code])

  if (whenAlone === WHEN_ALONE_LIST) {
    row.shown = [SHOWN.UPLOAD_AS_LIST]
  } else if (typeof whenAlone === 'string') {
    const fallback = FALLBACKS[whenAlone]
    Object.assign(row.cells, fallbackCells(upload, fallback))
    row.fallbacks.push(`${fallbackName(fallback)}, when alone`)
    usage[whenAlone].alone.push(code)
  } else {
    Object.assign(row.cells, pageCopyCells(whenAlone))
  }

  if (inList === CATCH_ALL) {
    const fallback = FALLBACKS[CATCH_ALL]
    row.cells.listHeading = fallbackCells(upload, fallback).pageHeading
    row.fallbacks.push(`${fallbackName(fallback)} title, in a list`)
    usage[CATCH_ALL].inList.push(code)
  } else {
    Object.assign(row.cells, {
      listHeading: withVariants(inList, 'heading', String),
      item: withVariants(inList, 'item', partsText),
      detail: withVariants(inList, 'detail', partsText),
      listNote: inList.note
    })
    row.partsNote = [inList, ...Object.values(inList.variants ?? {})].some(
      ({ item, detail }) => Array.isArray(item) || Array.isArray(detail)
    )
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
    const copies = fallbackCopies(upload, fallback)
    const row = {
      id: `upload.${fallback.key}`,
      shown: [SHOWN.FALLBACK],
      statuses: copies.map(({ copy }) => statusOf(copy)),
      cells: fallbackCells(upload, fallback),
      paths: [['upload', fallback.key]],
      fallbacks: [
        ...usedBy(usage[name].alone, 'Shown alone'),
        ...usedBy(usage[name].inList, 'Its title heads a list')
      ]
    }
    return row
  })
}

function editRow(code, entry) {
  const row = newRow(code, SHOWN.EDIT, entry, ['edit', code])
  row.cells.summary = entry.summary
  row.cells.inline = entry.inline
  if (entry.summary === undefined) {
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
    // Which part of the row each path's comments are about.
    pathLabels: [...upload.shown, ...edit.shown],
    fallbacks: [
      ...upload.fallbacks,
      ...edit.fallbacks.map((fallback) => `${SHOWN.EDIT}: ${fallback}`)
    ]
  }
}

function uploadAndEditRows(value) {
  const { upload, edit } = value
  const usage = Object.fromEntries(
    Object.keys(FALLBACKS).map((name) => [name, { alone: [], inList: [] }])
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
  return [...errors, ...edits.values(), ...fallbackRows(upload, usage)]
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

/** The comments on the row's entries, each said of its part when it has two. */
function commentsText(row, file) {
  return row.paths
    .map((path, index) => {
      const comments = file.commentsOf(path)
      const label = row.pathLabels?.[index]
      return comments && label ? `${label}: ${comments}` : comments
    })
    .filter(Boolean)
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
    status,
    ...cells,
    fallback: row.fallbacks.join('\n'),
    values: valuesText(row, words),
    links: linksText(words, file.value),
    comments: commentsText(row, file),
    source: row.paths.map((path) => sourceUrl(file.lineOf(path))).join('\n')
  }
}

/** Sort by error ID, ignoring case. */
function byId(a, b) {
  return a.id.localeCompare(b.id, 'en', { sensitivity: 'base' })
}

/**
 * error-text.yaml's rows, sorted by error ID.
 *
 * @param {string} source - error-text.yaml's text
 * @param {{ sourceUrl?: (line: number) => string }} [options]
 *   the link to a line of the file; by default its line anchor alone
 * @returns {Array<Record<string, string>>} a row has a value for each of COLUMNS' keys
 */
export function buildRows(source, { sourceUrl = (line) => `#L${line}` } = {}) {
  const file = readErrorTextSource(source)
  return [
    ...commonRows(file.value),
    ...uploadTextRows(file.value),
    ...uploadAndEditRows(file.value),
    ...formRows(file.value),
    ...pageRows(file.value)
  ]
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

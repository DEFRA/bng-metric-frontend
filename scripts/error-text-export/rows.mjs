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
export const STATUS_ORDER = Object.freeze([
  STATUS.NEEDS_CONTENT,
  STATUS.AWAITING_UCD,
  STATUS.FINAL
])

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
      ['legacyTemplate', 'For a legacy template file'],
      ['serviceTemplate', 'For a BNG Service template file']
    ]
  },
  [SHARED_PAGE.FILE_PROBLEM]: { key: 'fileProblem', label: 'File problem' },
  [SHARED_PAGE.SERVICE_PROBLEM]: {
    key: 'serviceProblem',
    label: 'Service problem'
  }
})

// The pages entry an edit page shows for a refusal it has no words for: it
// passes the backend's 422 on, and a 400 or 422 shows this page
// (src/server/common/helpers/errors.js).
const REFUSED_EDIT_PAGE = 'badRequest'

const PLACEHOLDER = /\{(\w+)\}/g
const LINK = /\[[^\]]+\]\(([^)]+)\)/g
// A link as the user sees it: its text alone. The Links column says where
// each goes.
const LINK_TEXT = /\[([^\]]+)\]\([^)]+\)/g

function asShown(text) {
  return text.replaceAll(LINK_TEXT, '$1')
}

/** The {names} texts use, each once, in order. */
function placeholdersIn(texts) {
  return unique(
    texts
      .flat()
      .filter(Boolean)
      .flatMap((text) => [...String(text).matchAll(PLACEHOLDER)])
      .map(([, name]) => name)
  )
}

/** Names as a reader lists them: "{a}", "{a} and {b}", "{a}, {b} and {c}". */
function listed(names, last) {
  const braced = names.map((name) => `{${name}}`)
  return braced.length < 2
    ? braced.join('')
    : `${braced.slice(0, -1).join(', ')} ${last} ${braced.at(-1)}`
}

/**
 * A list of options as one text, each after the first saying when it is
 * used: the page shows the first whose {values} it can fill, so a later one
 * stands in when a value the one before it names is not known.
 * "This parcel {ref} …", then "If {ref} is not known: Your … file …".
 */
function optionsText(options) {
  const list = [options].flat()
  return list
    .map((text, index) => {
      if (index === 0) {
        return text
      }
      const own = placeholdersIn([text])
      const missing = placeholdersIn([list[index - 1]]).filter(
        (name) => !own.includes(name)
      )
      return missing.length > 0
        ? `If ${listed(missing, 'or')} is not known: ${text}`
        : `Otherwise: ${text}`
    })
    .join('\n')
}

// A whole page given in versions: the page shows the first whose title,
// subheading and body it can fill.
const NO_TEXT = '(none)'

/**
 * When each version of a page is shown, as a line of a cell begins: the
 * values it needs are known, and the last otherwise.
 */
function versionConditions(pages) {
  return pages.map((page, index) => {
    const names = placeholdersIn([page.title, page.subheading, page.body])
    return index === pages.length - 1 || names.length === 0
      ? 'Otherwise'
      : `If ${listed(names, 'and')} ${names.length === 1 ? 'is' : 'are'} known`
  })
}

/**
 * One part of a page given in versions: shown once when every version says
 * the same, and otherwise a line a version, after when it is shown, so each
 * column of the row reads alike.
 */
function versionsText(texts, conditions) {
  if (texts.every((text) => text === undefined)) {
    return undefined
  }
  if (new Set(texts).size === 1) {
    return texts[0]
  }
  return texts
    .map((text, index) => `${conditions[index]}: ${text ?? NO_TEXT}`)
    .join('\n')
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
/**
 * A single-problem page's words, one cell a part. A page given in versions
 * gives each its line in every cell, after when it is shown.
 *
 * @param {object | object[]} copies - a page, or its versions
 */
function pageCopyCells(copies) {
  const list = [copies].flat()
  const conditions = versionConditions(list)
  const cell = (key) =>
    versionsText(
      list.map((copy) =>
        copy[key] === undefined ? undefined : optionsText(copy[key])
      ),
      conditions
    )
  return {
    pageHeading: cell('title'),
    subheading: cell('subheading'),
    body: cell('body')
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

const INDENT = '  '

/** Each line of a text indented by `depth` steps. */
function indented(text, depth) {
  return text
    .split('\n')
    .map((line) => `${INDENT.repeat(depth)}${line}`)
    .join('\n')
}

// A page's parts as a reviewer reads them: the part, then its words.
const PAGE_PARTS = Object.freeze([
  ['title', 'Heading'],
  ['subheading', 'Subheading'],
  ['body', 'Body']
])

/** A page's words, a labelled line a part: "Heading: …", "Body: …". */
function pageLines(copy) {
  return PAGE_PARTS.filter(([key]) => copy[key] !== undefined)
    .map(([key, part]) => `${part}: ${optionsText(copy[key])}`)
    .join('\n')
}

/**
 * Lines for each of a fallback's copies, under "For a … template file:"
 * where its copies differ, as the catch-all's do.
 */
function copiesLines(upload, fallback, render) {
  const copies = fallbackCopies(upload, fallback).map(({ label, copy }) => [
    label,
    render(copy)
  ])
  return new Set(copies.map(([, text]) => text)).size === 1
    ? copies[0][1]
    : copies
        .map(([label, text]) => `${label}:\n${indented(text, 1)}`)
        .join('\n')
}

/**
 * A shared fallback a code shows, said plainly, with the words the user sees:
 * its page when the code is the file's only problem, or its title heading
 * the code in the problems list.
 */
function fallbackEntry(upload, fallback, inList) {
  if (inList) {
    const title = copiesLines(upload, fallback, (copy) =>
      optionsText(copy.title)
    )
    return `If the file has other problems too, listed under the ${fallback.label} heading:\n${indented(title, 1)}`
  }
  const page = copiesLines(upload, fallback, pageLines)
  return `If this is the file's only problem, the shared ${fallback.label} page (upload.${fallback.key}):\n${indented(page, 1)}`
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
 * An upload error's single-problem page's words: worded for any number, or
 * for one and for several, the last in its own columns.
 */
function singleProblemCells(page) {
  if (page === undefined) {
    return {}
  }
  if (!Object.hasOwn(page, 'one')) {
    return pageCopyCells(page)
  }
  return page.several === undefined
    ? pageCopyCells(page.one)
    : { ...pageCopyCells(page.one), ...severalCells(page.several) }
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
    Object.assign(row.cells, fallbackCells(upload, fallback))
    row.statuses.push(...fallbackStatuses(upload, fallback))
    row.fallbacks.push(fallbackEntry(upload, fallback, false))
    usage[singleProblemPage].alone.push(code)
  } else {
    Object.assign(row.cells, singleProblemCells(singleProblemPage))
  }

  if (problemsList === PROBLEMS_LIST_CATCH_ALL) {
    const fallback = FALLBACKS[SHARED_PAGE.CATCH_ALL]
    row.cells.listHeading = fallbackCells(upload, fallback).pageHeading
    row.statuses.push(...fallbackStatuses(upload, fallback))
    row.fallbacks.push(fallbackEntry(upload, fallback, true))
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

/**
 * What an edit with no words of its own shows: the error page a refused save
 * takes the user to, quoted, so whoever reviews the wording sees what the
 * user sees today.
 */
function unwordedEditText(pages) {
  const page = pages?.[REFUSED_EDIT_PAGE]
  const lines = [
    ...(page?.title ? [`Heading: ${page.title}`] : []),
    ...(page?.body ?? []).map((line) => `Body: ${line}`)
  ]
  const intro = `If a change made on screen is refused, it has no words of its own yet: the error page pages.${REFUSED_EDIT_PAGE}, in place of the form`
  return lines.length > 0
    ? `${intro}:\n${indented(lines.join('\n'), 1)}`
    : intro
}

function editRow(code, entry, pages) {
  const row = newRow(code, SHOWN.EDIT, entry, ['edit', code])
  // A refusal no one field can put right is shown in the error summary only.
  row.cells.summary = entry.summary ?? entry.summaryOnly
  row.cells.inline = entry.inline
  if (row.cells.summary === undefined) {
    row.fallbacks.push(unwordedEditText(pages))
    // No further on than the page shown in its place.
    if (pages?.[REFUSED_EDIT_PAGE]) {
      row.statuses.push(statusOf(pages[REFUSED_EDIT_PAGE]))
    }
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
      // Each says it is of a change made on screen.
      ...edit.fallbacks
    ]
  }
}

function uploadAndEditRows(value) {
  const { upload, edit } = value
  const usage = Object.fromEntries(
    Object.keys(FALLBACKS).map((name) => [name, { alone: [], listed: [] }])
  )
  const edits = new Map(
    Object.entries(edit).map(([code, entry]) => [
      code,
      editRow(code, entry, value.pages)
    ])
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
    WORDING_KEYS.map((key) => [key, asShown(row.cells[key] ?? '')])
  )
  const fallback = row.fallbacks.join('\n')
  return {
    id: row.id,
    shown: unique(row.shown).join('; '),
    status,
    ...cells,
    fallback: asShown(fallback),
    values: valuesText(row, words),
    // From the words as written, before their links are shown as text, and
    // the fallbacks' too, as their words now hold links.
    links: linksText([...words, fallback], file.value),
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

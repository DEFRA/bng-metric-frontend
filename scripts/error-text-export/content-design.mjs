import { COLUMNS, SHOWN, STATUS, WORDING_KEYS, isUploadText } from './rows.mjs'

// UCD's content design sheet, a Google Sheet that is the master copy of the
// error wording they have checked, compared with the export's rows: for each
// of the sheet's rows, whether the service shows the same words, and which
// error codes one has and not the other. No I/O but fetchSheet.
//
// The sheet has a row for each problem, a "Code" column naming the backend
// error code or codes it is for, and its words in the parts of the drop-out
// page: H1, H2, body, and body for several habitats. Its layout is the
// problems list's: the H1 is the problems list's own heading, the H2 the
// layer's subheading and the body the problem's line. The service still
// shows most errors on a single-problem page of their own, so each of the
// sheet's parts is compared with the service's words for either.

/** Each column the sheet must have, by its header. */
export const SHEET_HEADERS = Object.freeze({
  ref: 'Ref',
  problem: 'Problem',
  code: 'Code',
  h1: 'Dropout page title (H1)',
  h2: 'Dropout error subheading (H2)',
  body: 'Bodytext',
  plural: 'Bodytext (Plural)'
})

/**
 * The sheet's other columns, by their header: carried into the CSV laid out
 * like the sheet, and blank when the sheet has no such column.
 */
export const SHEET_OTHER_HEADERS = Object.freeze({
  category: 'Error category',
  whenChecked: 'When checked',
  candidate: 'Candidate for user testing?',
  jira: 'Original Jira'
})

/** What the comparison says of a row, as the Check column says it. */
export const CHECK = Object.freeze({
  MATCHES: 'Matches',
  DIFFERS: 'Differs',
  DIFFERS_FROM_FINAL: 'Differs from Final',
  NOT_IN_SERVICE: 'Not in service',
  NOT_IN_SHEET: 'Not in sheet',
  NO_WORDING: 'No wording in sheet',
  DUPLICATE: 'Duplicate row',
  NO_CODE: 'No error code in sheet',
  OUTSIDE_SHEET: 'Not covered by sheet',
  NOT_COMPARED: 'Sheet not read'
})

/** Most in need of a fix first, as the counts list them. */
export const CHECK_ORDER = Object.freeze([
  CHECK.DIFFERS_FROM_FINAL,
  CHECK.NOT_IN_SERVICE,
  CHECK.NOT_IN_SHEET,
  CHECK.DIFFERS,
  CHECK.NO_CODE,
  CHECK.DUPLICATE,
  CHECK.NO_WORDING,
  CHECK.MATCHES,
  CHECK.OUTSIDE_SHEET,
  CHECK.NOT_COMPARED
])

/**
 * Each part of the sheet's wording, and the export's columns that can hold
 * the service's words for it, its own page's first. The sheet's H1 also
 * matches the problems list's own heading, its H1.
 */
export const PARTS = Object.freeze([
  {
    key: 'h1',
    label: 'H1',
    service: ['pageHeading', 'pageHeadingSeveral'],
    listPageTitle: true
  },
  { key: 'h2', label: 'H2', service: ['subheading', 'subheadingSeveral'] },
  { key: 'body', label: 'Body', service: ['body', 'listHeading'] },
  { key: 'plural', label: 'Plural', service: ['bodySeveral', 'listHeading'] }
])

// The rows whose words are the problems list's H1. upload.page.title is the
// browser's title alone, so is not compared.
const LIST_PAGE_TITLE_IDS = Object.freeze(['upload.page.listHeading'])

// What the sheet writes in a part that has no words.
const NO_WORDS = new Set(['', 'n/a', 'na', '-', 'none'])
// What a part the service has no words for says, in place of them.
const NO_SERVICE_WORDS = '(none)'

// An error code, as the backend names them, or a YAML key the sheet names a
// shared page by. A code ending "_*" stands for every code it begins.
const CODE =
  /\b[A-Z][A-Z0-9]*(?:(?:_[A-Z0-9]+)+(?:_\*)?|_\*)|\bupload\.[a-zA-Z]+/g
const WILDCARD = '_*'
const ERROR_CODE = /^[A-Z][A-Z0-9_]+$/

// The words a cell's line begins with when the service shows it only in some
// cases, as rows.mjs writes them: "If {ref} is not known: …".
const CONDITION = /^\s*(?:If |For |Otherwise|With )[^:]*:\s*/
// The words a variant's line begins with, as rows.mjs writes them:
// "bng-service variant: …". The page shows the variant's words alone.
const VARIANT = /^\s*[\w-]+ variant:\s*/
const LINK_TEXT = /\[([^\]]+)\]\([^)]+\)/g
const PLACEHOLDER = /\{[^}]*\}/g
const QUOTES = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"']
]
const SPACES = /\s+/g
const TRAILING_STOP = /\.$/

const COLUMN_HEADERS = Object.fromEntries(
  COLUMNS.map(({ key, header }) => [key, header])
)

// --- The sheet ---

/**
 * A CSV's records (RFC 4180): a quoted field can hold commas, quotes and
 * line breaks.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const records = []
  let record = []
  let field = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field.replace(/\r$/, ''))
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records
}

/**
 * The sheet's rows, each by SHEET_HEADERS' keys. Refuses a sheet without one
 * of its columns, as a renamed column would otherwise read as no words.
 *
 * @param {string} csv - the sheet as CSV
 * @returns {Array<Record<keyof typeof SHEET_HEADERS, string>>}
 */
export function readSheet(csv) {
  const [headers = [], ...records] = parseCsv(csv)
  const trimmed = headers.map((header) => header.trim())
  const indexes = Object.entries(SHEET_HEADERS).map(([key, header]) => [
    key,
    trimmed.indexOf(header)
  ])
  const missing = indexes.filter(([, index]) => index < 0)
  if (missing.length > 0) {
    const names = missing.map(([key]) => `"${SHEET_HEADERS[key]}"`).join(', ')
    throw new Error(`The content design sheet has no ${names} column`)
  }
  for (const [key, header] of Object.entries(SHEET_OTHER_HEADERS)) {
    indexes.push([key, trimmed.indexOf(header)])
  }
  return records
    .filter((record) => record.some((value) => value.trim() !== ''))
    .map((record) =>
      Object.fromEntries(
        indexes.map(([key, index]) => [
          key,
          index < 0 ? '' : (record[index] ?? '').trim()
        ])
      )
    )
}

/**
 * The URL a Google Sheet's tab downloads from as CSV, from the URL it is
 * opened at: .../d/<id>/edit?gid=<tab>#gid=<tab>. A URL that already
 * downloads it is kept.
 *
 * @param {string} url
 * @returns {string}
 */
export function sheetCsvUrl(url) {
  const parsed = new URL(url)
  const id = /\/spreadsheets\/d\/([^/]+)/.exec(parsed.pathname)?.[1]
  if (!id || parsed.pathname.endsWith('/export')) {
    return url
  }
  const gid =
    parsed.searchParams.get('gid') ?? /gid=(\d+)/.exec(parsed.hash)?.[1] ?? '0'
  return `${parsed.origin}/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
}

/**
 * The sheet as CSV. It must be shared with anyone with the link: a sheet
 * that is not sends Google's sign-in page instead.
 *
 * @param {string} url - the sheet's URL, as opened or as a CSV download
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string>}
 */
export async function fetchSheet(url, fetchImpl = fetch) {
  const response = await fetchImpl(sheetCsvUrl(url), { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(
      `Could not read the content design sheet: HTTP ${response.status}`
    )
  }
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('text/csv')) {
    throw new Error(
      'Could not read the content design sheet: Google did not send it as CSV, so it may no longer be shared with anyone with the link'
    )
  }
  return response.text()
}

// --- Comparing ---

/**
 * A text as compared: a link by its text, any {value} alike, quotes straight,
 * spaces single, and no full stop at its end. Capitals and spelling count.
 */
export function normalise(text) {
  let result = String(text ?? '')
    .replaceAll(LINK_TEXT, '$1')
    .replaceAll(PLACEHOLDER, '{}')
  for (const [pattern, replacement] of QUOTES) {
    result = result.replaceAll(pattern, replacement)
  }
  return result.replaceAll(SPACES, ' ').trim().replace(TRAILING_STOP, '')
}

/** A cell's texts, one for each case it is shown in, as compared. */
function alternatives(cell) {
  return String(cell ?? '')
    .split('\n')
    .map((line) => normalise(line.replace(CONDITION, '').replace(VARIANT, '')))
    .filter(Boolean)
}

function hasWords(text) {
  return !NO_WORDS.has(
    String(text ?? '')
      .trim()
      .toLowerCase()
  )
}

/**
 * The error IDs a Code cell names: each code it holds, and for a code
 * ending "_*" every known ID it begins.
 *
 * @param {string} cell
 * @param {string[]} knownIds
 * @returns {string[]}
 */
export function codesIn(cell, knownIds) {
  const found = String(cell ?? '').match(CODE) ?? []
  const ids = found.flatMap((code) => {
    if (!code.endsWith(WILDCARD)) {
      return [code]
    }
    const prefix = code.slice(0, -1)
    const matched = knownIds.filter((id) => id.startsWith(prefix)).sort()
    // One that begins none is still a code the sheet names: the service lacks it.
    return matched.length > 0 ? matched : [code]
  })
  return [...new Set(ids)]
}

/** The service's words a part can match, under each column's header but its first. */
function serviceText(row, part) {
  return part.service
    .filter((key) => hasWords(row[key]))
    .map((key) =>
      key === part.service[0] ? row[key] : `${COLUMN_HEADERS[key]}: ${row[key]}`
    )
    .join('\n')
}

/**
 * The parts of a sheet row whose words the service does not show, with both
 * texts.
 */
function differingParts(sheetRow, row, listPageTitles) {
  return PARTS.filter((part) => hasWords(sheetRow[part.key])).flatMap(
    (part) => {
      const candidates = part.service.flatMap((key) => alternatives(row[key]))
      if (part.listPageTitle) {
        candidates.push(...listPageTitles)
      }
      if (candidates.includes(normalise(sheetRow[part.key]))) {
        return []
      }
      return [
        {
          label: part.label,
          sheet: sheetRow[part.key],
          service: serviceText(row, part) || NO_SERVICE_WORDS
        }
      ]
    }
  )
}

/** The sheet's words, a part a line, for a row the service has no code for. */
function sheetWords(sheetRow) {
  return PARTS.filter((part) => hasWords(sheetRow[part.key])).map((part) => ({
    label: part.label,
    sheet: sheetRow[part.key],
    service: ''
  }))
}

function checkOf(row, parts) {
  if (parts.length === 0) {
    return CHECK.MATCHES
  }
  return row.status === STATUS.FINAL ? CHECK.DIFFERS_FROM_FINAL : CHECK.DIFFERS
}

/** Whether a row is one the sheet is meant to cover: an error code or a shared page. */
function sheetCovers(row) {
  return ERROR_CODE.test(row.id) || row.shown === SHOWN.FALLBACK
}

/**
 * Compare one sheet row's codes with the export's rows.
 *
 * @returns {Array<object>} a result for each code it names, or one for none
 */
function compareSheetRow(sheetRow, context) {
  const { byId, firstRef, listPageTitles } = context
  const base = {
    ref: sheetRow.ref,
    problem: sheetRow.problem,
    sheetColumns: Object.fromEntries(
      Object.keys(SHEET_OTHER_HEADERS).map((key) => [key, sheetRow[key] ?? ''])
    )
  }
  const ids = codesIn(sheetRow.code, [...byId.keys()])
  if (ids.length === 0) {
    return [
      {
        ...base,
        id: sheetRow.code.split('\n')[0],
        check: CHECK.NO_CODE,
        status: '',
        source: '',
        parts: sheetWords(sheetRow)
      }
    ]
  }
  return ids.map((id) => {
    const row = byId.get(id)
    const earlier = firstRef.get(id)
    if (earlier === undefined) {
      firstRef.set(id, sheetRow.ref)
    }
    if (!row) {
      return {
        ...base,
        id,
        check: CHECK.NOT_IN_SERVICE,
        status: '',
        source: '',
        parts: sheetWords(sheetRow)
      }
    }
    const found = { ...base, id, status: row.status, source: row.source }
    if (earlier !== undefined) {
      return {
        ...found,
        check: CHECK.DUPLICATE,
        duplicateOf: earlier,
        parts: []
      }
    }
    if (!PARTS.some((part) => hasWords(sheetRow[part.key]))) {
      return { ...found, check: CHECK.NO_WORDING, parts: [] }
    }
    const parts = differingParts(sheetRow, row, listPageTitles)
    return { ...found, check: checkOf(row, parts), parts }
  })
}

/**
 * The sheet compared with the export: a result for each code each sheet row
 * names, in the sheet's order, then one for each error code or shared page
 * the service has and the sheet does not, then one for each other error the
 * sheet does not cover, such as a form's. The drop-out page's building
 * blocks, such as upload.unknown.blank, are not errors and have none.
 *
 * @param {ReturnType<typeof readSheet>} sheetRows
 * @param {Array<Record<string, string>>} rows - from buildRows, every group
 * @returns {Array<{
 *   ref: string, problem: string, id: string, check: string, status: string,
 *   source: string, duplicateOf?: string,
 *   parts: Array<{ label: string, sheet: string, service: string }>
 * }>}
 */
export function compareWithSheet(sheetRows, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const listPageTitles = LIST_PAGE_TITLE_IDS.flatMap((id) =>
    alternatives(byId.get(id)?.body)
  )
  const context = { byId, firstRef: new Map(), listPageTitles }
  const results = sheetRows.flatMap((sheetRow) =>
    compareSheetRow(sheetRow, context)
  )
  const missing = rows
    .filter((row) => sheetCovers(row) && !context.firstRef.has(row.id))
    .map((row) => unmatched(row, CHECK.NOT_IN_SHEET))
  // The drop-out page's building blocks are not errors, so are left out.
  const outside = rows
    .filter((row) => !sheetCovers(row) && !isUploadText(row))
    .map((row) => unmatched(row, CHECK.OUTSIDE_SHEET))
  return [...results, ...missing, ...outside]
}

/** A row's words, a part a line after its column's header. */
function rowWords(row) {
  return [`Where it is shown: ${row.shown}`]
    .concat(
      WORDING_KEYS.filter((key) => hasWords(row[key])).map(
        (key) => `${COLUMN_HEADERS[key]}: ${row[key]}`
      )
    )
    .join('\n')
}

/** A result for a row no sheet row is compared with, with its own words. */
function unmatched(row, check) {
  return {
    ref: '',
    problem: '',
    id: row.id,
    check,
    status: row.status,
    source: row.source,
    serviceWords: rowWords(row),
    parts: []
  }
}

/**
 * Every error's row, each with its own words, for when the sheet could not be
 * read: the page still lists every error. The drop-out page's building blocks
 * are left out, as compareWithSheet leaves them out.
 *
 * @param {Array<Record<string, string>>} rows - from buildRows, every group
 * @returns {ReturnType<typeof compareWithSheet>}
 */
export function notCompared(rows) {
  return rows
    .filter((row) => !isUploadText(row))
    .map((row) => unmatched(row, CHECK.NOT_COMPARED))
}

/**
 * How many results have each check, most in need of a fix first, leaving
 * out those none has.
 *
 * @param {Array<{ check: string }>} results
 * @returns {Array<[string, number]>}
 */
export function checkCounts(results) {
  return CHECK_ORDER.map((check) => [
    check,
    results.filter((result) => result.check === check).length
  ]).filter(([, count]) => count > 0)
}

/** The comparison's columns, for its CSV: one row a result. */
export const CHECK_COLUMNS = Object.freeze([
  { key: 'ref', header: 'Sheet ref' },
  { key: 'id', header: 'Error ID' },
  { key: 'check', header: 'Check' },
  { key: 'status', header: 'Status in service' },
  { key: 'problem', header: 'Problem (sheet)' },
  { key: 'differs', header: 'Parts that differ' },
  { key: 'sheet', header: 'Content design (sheet)' },
  { key: 'service', header: 'Service now (error-text.yaml)' },
  { key: 'source', header: 'Source' }
])

function partLines(parts, side) {
  return parts
    .filter((part) => part[side])
    .map((part) => `${part.label}: ${part[side]}`)
    .join('\n')
}

/**
 * A result as one record of CHECK_COLUMNS' keys: each differing part's
 * texts a line, after its label.
 *
 * @param {ReturnType<typeof compareWithSheet>[number]} result
 * @returns {Record<string, string>}
 */
export function checkRecord(result) {
  const differs =
    result.check === CHECK.DIFFERS || result.check === CHECK.DIFFERS_FROM_FINAL
  return {
    ref: result.ref,
    id: result.id,
    check: result.duplicateOf
      ? `${result.check} of Ref ${result.duplicateOf}`
      : result.check,
    status: result.status,
    problem: result.problem,
    differs: differs ? result.parts.map((part) => part.label).join(', ') : '',
    sheet: partLines(result.parts, 'sheet'),
    service: differs
      ? partLines(result.parts, 'service')
      : (result.serviceWords ?? ''),
    source: result.source
  }
}

// --- The CSV laid out like the sheet ---

/**
 * The columns of the CSV laid out like the content design sheet: the sheet's
 * own columns in its order, so its rows can be pasted into it, then what the
 * comparison found.
 */
export const SHEET_LAYOUT_COLUMNS = Object.freeze([
  { key: 'category', header: SHEET_OTHER_HEADERS.category },
  { key: 'ref', header: SHEET_HEADERS.ref },
  { key: 'problem', header: SHEET_HEADERS.problem },
  { key: 'code', header: SHEET_HEADERS.code },
  { key: 'whenChecked', header: SHEET_OTHER_HEADERS.whenChecked },
  { key: 'h1', header: SHEET_HEADERS.h1 },
  { key: 'h2', header: SHEET_HEADERS.h2 },
  { key: 'body', header: SHEET_HEADERS.body },
  { key: 'plural', header: SHEET_HEADERS.plural },
  { key: 'candidate', header: SHEET_OTHER_HEADERS.candidate },
  { key: 'jira', header: SHEET_OTHER_HEADERS.jira },
  { key: 'check', header: 'Check' },
  { key: 'status', header: 'Status in service' },
  { key: 'shown', header: 'Where it is shown' },
  { key: 'source', header: 'Source' }
])

/** The first of a row's cells that has words, or blank. */
function firstWords(row, keys) {
  const key = keys.find((name) => hasWords(row?.[name]))
  return key ? row[key] : ''
}

/**
 * The service's words for each of the sheet's parts, in full: what a row of
 * the sheet would hold for the service as it is.
 */
function serviceParts(row) {
  return {
    h1: firstWords(row, ['pageHeading', 'pageHeadingSeveral']),
    h2: firstWords(row, ['subheading', 'subheadingSeveral']),
    body: firstWords(row, ['body', 'inline', 'listHeading', 'summary']),
    plural: firstWords(row, ['bodySeveral'])
  }
}

/**
 * Each result as a row laid out like the content design sheet, holding the
 * service's current wording in full, in the order the page lists them: for
 * the content design team to copy into their working copy of the sheet.
 * A row the service has no code for keeps the sheet's own words.
 *
 * @param {ReturnType<typeof compareWithSheet>} results
 * @param {Array<Record<string, string>>} rows - from buildRows, every group
 * @returns {Array<Record<string, string>>}
 */
export function sheetLayoutRecords(results, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return results.map((result) => {
    const row = byId.get(result.id)
    const own = row
      ? serviceParts(row)
      : Object.fromEntries(
          result.parts.map((part) => [
            PARTS.find(({ label }) => label === part.label).key,
            part.sheet
          ])
        )
    return {
      category: '',
      whenChecked: '',
      candidate: '',
      jira: '',
      ...result.sheetColumns,
      ref: result.ref,
      problem: result.problem,
      code: result.id,
      h1: own.h1 ?? '',
      h2: own.h2 ?? '',
      body: own.body ?? '',
      plural: own.plural ?? '',
      check: result.duplicateOf
        ? `${result.check} of Ref ${result.duplicateOf}`
        : result.check,
      status: result.status,
      shown: row ? [row.shown].flat().join('; ') : '',
      source: result.source
    }
  })
}

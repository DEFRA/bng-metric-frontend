import {
  CHECK,
  checkCounts,
  checkRecord,
  notCompared
} from './content-design.mjs'
import { SHORT_SHA_LENGTH } from './git.mjs'
import { isUploadText, statusCounts } from './rows.mjs'

// The export as a Confluence page, in Confluence's storage format (XHTML with
// its own macros), and a client that publishes it: the page's body, and its
// files as attachments, each replacing the last run's file of its name.
//
// The page says it is generated and that edits to it will be overwritten.
// It has two tables: the content design sheet compared with the service's
// wording, then every error message, as the export has them.

/** The files the page attaches, by a name that stays the same run to run. */
export const ATTACHMENTS = Object.freeze({
  XLSX: 'error-messages.xlsx',
  CSV: 'error-messages.csv',
  CHECK_CSV: 'content-design-check.csv',
  SHEET_LAYOUT_CSV: 'content-design-sheet-layout.csv'
})

// A status lozenge's colour for each check: red for what must be fixed or
// decided, amber for wording still to change, grey for the sheet's own.
const CHECK_COLOURS = Object.freeze({
  [CHECK.MATCHES]: 'Green',
  [CHECK.DIFFERS]: 'Yellow',
  [CHECK.DIFFERS_FROM_FINAL]: 'Red',
  [CHECK.NOT_IN_SERVICE]: 'Red',
  [CHECK.NOT_IN_SHEET]: 'Red',
  [CHECK.NO_WORDING]: 'Grey',
  [CHECK.DUPLICATE]: 'Grey',
  [CHECK.NO_CODE]: 'Grey',
  [CHECK.OUTSIDE_SHEET]: 'Blue',
  [CHECK.NOT_COMPARED]: 'Grey'
})

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

/**
 * The page's properties, set on each publish so they hold whatever is
 * changed: full width, as its tables are unreadable at Confluence's narrow
 * default, and the current editor, whose tables keep their header row in view
 * on scrolling. A page published through the API is otherwise shown in the
 * legacy editor, whose headers scroll away.
 */
export const PAGE_PROPERTIES = Object.freeze([
  ['content-appearance-published', 'max'],
  ['content-appearance-draft', 'max'],
  ['editor', 'v2']
])

// --- Storage format ---

// The control characters XML 1.0 does not allow, which a sheet's cell can hold.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

/** Text as XHTML: escaped, without characters XML forbids, each line break a <br />. */
export function text(value) {
  return String(value ?? '')
    .replaceAll(FORBIDDEN_CHARS, '')
    .replaceAll(/[&<>"]/g, (char) => ESCAPES[char])
    .replaceAll('\n', '<br />')
}

function link(url, label) {
  return `<a href="${text(url)}">${text(label)}</a>`
}

function lozenge(title, colour) {
  return [
    '<ac:structured-macro ac:name="status">',
    `<ac:parameter ac:name="colour">${colour}</ac:parameter>`,
    `<ac:parameter ac:name="title">${text(title)}</ac:parameter>`,
    '</ac:structured-macro>'
  ].join('')
}

function panel(name, body) {
  return `<ac:structured-macro ac:name="${name}"><ac:rich-text-body>${body}</ac:rich-text-body></ac:structured-macro>`
}

function attachmentLink(filename) {
  return `<ac:link><ri:attachment ri:filename="${text(filename)}" /></ac:link>`
}

// A column's width, in pixels, from the characters its text runs to: about
// as wide as a line of a long cell, so short codes get a narrow column and
// wording a wide one, within bounds.
const PIXELS_PER_CHARACTER = 7
const CELL_PADDING = 24
const MIN_COLUMN_WIDTH = 60
const MAX_COLUMN_WIDTH = 480
// A cell's length is its longest line; a column's is that of its longer cells,
// not its very longest, so one long cell does not widen it for every row.
const LENGTH_PERCENTILE = 0.9

function lineLength(value) {
  return Math.max(
    0,
    ...String(value ?? '')
      .split('\n')
      .map((line) => line.length)
  )
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ??
    0
  )
}

/**
 * Each column's width, in pixels, in proportion to its text: its header's,
 * and its longer cells'.
 *
 * @param {string[]} headers
 * @param {string[][]} texts - each row's cells as plain text
 * @returns {number[]}
 */
export function columnWidths(headers, texts) {
  return headers.map((header, index) => {
    const cells = texts.map((cells) => lineLength(cells[index]))
    const characters = Math.max(
      lineLength(header),
      percentile(cells, LENGTH_PERCENTILE)
    )
    const width = characters * PIXELS_PER_CHARACTER + CELL_PADDING
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width))
  })
}

/**
 * A table: a header row, then a row for each of `rows`' cells, which are
 * XHTML already. With `widths`, its columns are those widths, in pixels.
 */
function table(headers, rows, widths) {
  const head = headers.map((header) => `<th>${text(header)}</th>`).join('')
  const body = rows
    .map(
      (cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
    )
    .join('')
  if (!widths) {
    return `<table><tbody><tr>${head}</tr>${body}</tbody></table>`
  }
  const total = widths.reduce((sum, width) => sum + width, 0)
  const columns = widths
    .map((width) => `<col style="width: ${width}px;" />`)
    .join('')
  return `<table data-layout="default" data-table-width="${total}"><colgroup>${columns}</colgroup><tbody><tr>${head}</tr>${body}</tbody></table>`
}

/** A Source cell's URLs: one for each entry the row is made of. */
function sourceUrls(source) {
  return String(source ?? '')
    .split('\n')
    .filter(Boolean)
}

// --- The page ---

function aboutSection(rows, meta) {
  const commit = meta.commit.slice(0, SHORT_SHA_LENGTH)
  const counts = Object.entries(statusCounts(rows))
    .map(([status, count]) => `${count} ${status}`)
    .join(', ')
  const notice = panel(
    'info',
    [
      '<p><strong>This page is generated from the code. Edits made here will be overwritten.</strong></p>',
      `<p>It is published from ${link(meta.fileUrl, 'error-text.yaml')} in bng-metric-frontend by the Error Messages Export workflow, each time a change to the error wording reaches <code>main</code>. To change a message, change error-text.yaml by pull request.</p>`
    ].join('')
  )
  const generated = `<p>Generated ${text(meta.date)} from branch <code>${text(meta.branch)}</code> at commit ${link(meta.commitUrl, commit)}. ${rows.length} error IDs: ${text(counts)}.</p>`
  const files = [
    `<p>Files: ${attachmentLink(ATTACHMENTS.XLSX)}, ${attachmentLink(ATTACHMENTS.CSV)} and ${attachmentLink(ATTACHMENTS.CHECK_CSV)} (the content design check).</p>`,
    `<p>For the content design sheet: ${attachmentLink(ATTACHMENTS.SHEET_LAYOUT_CSV)} has the table below laid out in the sheet’s own columns, holding the service’s current wording in full, to copy rows into a working copy of the sheet.</p>`
  ].join('')
  return [notice, generated, files].join('')
}

const CHECK_INTRO =
  '<p>Every error message in error-text.yaml. Each row of the content design sheet is compared with what the service shows for its error code, and only the parts that differ are shown. Error codes and shared pages the sheet does not have follow it, then the messages the sheet does not cover, such as form and whole-page errors, each with its words. The sheet describes the problems list: its H1 matches the problems list’s heading, and its body matches either the single-problem page or the problems list heading. Capitals, spelling and punctuation count; a full stop at the end, the names of {values} and how links are written do not.</p>'

const CHECK_HEADERS = Object.freeze([
  'Ref',
  'Error ID',
  'Check',
  'Status in service',
  'Content design (sheet)',
  'Service now'
])

/** The check table's cells, as plain text, a row each. */
function checkTexts(results) {
  return results.map((result) => {
    const record = checkRecord(result)
    return [
      record.ref,
      result.id,
      record.check,
      record.status,
      record.sheet,
      record.service
    ]
  })
}

function checkRows(results) {
  return results.map((result) => {
    const record = checkRecord(result)
    const [url] = sourceUrls(result.source)
    const id = url ? link(url, result.id) : `<code>${text(result.id)}</code>`
    return [
      text(record.ref),
      id,
      lozenge(record.check, CHECK_COLOURS[result.check]),
      text(record.status),
      text(record.sheet),
      text(record.service)
    ]
  })
}

/** Why the sheet was not compared, when it was not. */
function notComparedNotice(check) {
  if (check.error) {
    return panel(
      'warning',
      `<p>The content design sheet was not compared: ${text(check.error)}</p>`
    )
  }
  return check.results
    ? ''
    : '<p>The content design sheet was not compared: no sheet was given.</p>'
}

/**
 * Every message, each compared with the sheet when it could be read: the
 * sheet's rows first, then each error code and shared page it lacks, then
 * the messages it does not cover, such as forms and whole pages.
 */
function checkSection(check, rows) {
  const results = check.results ?? notCompared(rows)
  const counts = checkCounts(results)
    .map(([name, count]) => `${lozenge(name, CHECK_COLOURS[name])} ${count}`)
    .join(' ')
  return [
    '<h2>Error messages and content design check</h2>',
    notComparedNotice(check),
    CHECK_INTRO,
    `<p>${counts}</p>`,
    table(
      CHECK_HEADERS,
      checkRows(results),
      columnWidths(CHECK_HEADERS, checkTexts(results))
    )
  ].join('')
}

const BUILDING_BLOCKS_INTRO = [
  '<p>These are not errors. They are the pieces the drop-out page builds an error’s message from, so they are kept in error-text.yaml with the errors, as the page is only ever shown when a file is refused:</p>',
  '<ul>',
  '<li><strong>upload.page</strong>: the drop-out page’s own words, such as its title, the heading over its list of problems, and its buttons.</li>',
  '<li><strong>upload.names</strong>: how a problem names a habitat, such as “Feature Ref {featureRef}”, each falling back to the next when a value is not known.</li>',
  '<li><strong>upload.unknown</strong>: what is shown in place of a value the file leaves out, such as “blank” or “unknown habitat”.</li>',
  '<li><strong>upload.distinctiveness</strong>: the distinctiveness bands as the user reads them, such as “Very high” for V.High.</li>',
  '<li><strong>upload.layers</strong>: the subheading over the problems about each layer, such as “Habitat parcels”.</li>',
  '</ul>',
  '<p>They are not in the content design sheet, are not compared with it, and are not in the CSV files laid out for it. They are in the .xlsx and .csv of every message.</p>'
].join('')

const BUILDING_BLOCKS_HEADERS = Object.freeze([
  'Key',
  'Words',
  'Status',
  'Source'
])

/** The drop-out page's building blocks, in a table of their own. */
function buildingBlocksSection(rows) {
  const blocks = rows.filter(isUploadText)
  if (blocks.length === 0) {
    return ''
  }
  const texts = blocks.map((row) => [row.id, row.body, row.status, 'Line'])
  const cells = blocks.map((row) => {
    const [url] = sourceUrls(row.source)
    const line = /#L(\d+)$/.exec(url ?? '')?.[1]
    return [
      `<code>${text(row.id)}</code>`,
      text(row.body),
      text(row.status),
      url ? link(url, line ? `Line ${line}` : url) : ''
    ]
  })
  return [
    '<h2>Wording the drop-out page is built from</h2>',
    BUILDING_BLOCKS_INTRO,
    table(
      BUILDING_BLOCKS_HEADERS,
      cells,
      columnWidths(BUILDING_BLOCKS_HEADERS, texts)
    )
  ].join('')
}

/**
 * The page's body, in storage format.
 *
 * @param {Array<Record<string, string>>} rows - from buildRows, every group
 * @param {ReturnType<import('./export.mjs').exportMeta>} meta
 * @param {{ results?: ReturnType<import('./content-design.mjs').compareWithSheet>, error?: string }} check
 *   the content design check's results, or why there are none
 * @returns {string}
 */
export function pageBody(rows, meta, check) {
  return [
    aboutSection(rows, meta),
    checkSection(check, rows),
    buildingBlocksSection(rows)
  ].join('')
}

// --- The client ---

/**
 * A client for one Confluence Cloud site, as a user: their email address and
 * an API token. Its errors name the request and Confluence's response, never
 * the token.
 *
 * @param {{ baseUrl: string, email: string, token: string, fetchImpl?: typeof fetch }} options
 */
export function confluenceClient({ baseUrl, email, token, fetchImpl = fetch }) {
  const site = baseUrl.replace(/\/+$/, '')
  const authorization = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`

  async function request(method, path, { json, form } = {}) {
    const headers = { Authorization: authorization, Accept: 'application/json' }
    let body
    if (json) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(json)
    } else if (form) {
      // Confluence refuses an attachment upload without it, as a guard
      // against cross-site requests.
      headers['X-Atlassian-Token'] = 'no-check'
      body = form
    }
    const response = await fetchImpl(`${site}${path}`, {
      method,
      headers,
      body
    })
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300)
      throw new Error(
        `Confluence ${method} ${path} failed: HTTP ${response.status} ${detail}`
      )
    }
    return response.json()
  }

  return {
    /** The page, with its title and current version. */
    getPage(pageId) {
      return request('GET', `/wiki/api/v2/pages/${pageId}`)
    },

    /**
     * Replace the page's body: a new version, numbered after `version`.
     *
     * @param {string} pageId
     * @param {{ title: string, body: string, version: number, message: string }} update
     */
    updatePage(pageId, { title, body, version, message }) {
      return request('PUT', `/wiki/api/v2/pages/${pageId}`, {
        json: {
          id: pageId,
          status: 'current',
          title,
          body: { representation: 'storage', value: body },
          version: { number: version + 1, message }
        }
      })
    },

    /**
     * A property of the page, or undefined when it has none of that key.
     *
     * @param {string} pageId
     * @param {string} key
     * @returns {Promise<{ id: string, value: unknown, version: { number: number } } | undefined>}
     */
    async getPageProperty(pageId, key) {
      const { results = [] } = await request(
        'GET',
        `/wiki/api/v2/pages/${pageId}/properties?key=${encodeURIComponent(key)}`
      )
      return results[0]
    },

    /**
     * Set a property of the page, such as its width, when it is not set to
     * `value` already.
     *
     * @param {string} pageId
     * @param {string} key
     * @param {unknown} value
     * @returns {Promise<boolean>} whether it was changed
     */
    async setPageProperty(pageId, key, value) {
      const path = `/wiki/api/v2/pages/${pageId}/properties`
      const property = await this.getPageProperty(pageId, key)
      if (!property) {
        await request('POST', path, { json: { key, value } })
        return true
      }
      if (JSON.stringify(property.value) === JSON.stringify(value)) {
        return false
      }
      await request('PUT', `${path}/${property.id}`, {
        json: {
          key,
          value,
          version: { number: property.version.number + 1 }
        }
      })
      return true
    },

    /**
     * Attach a file to the page, as a new version of the attachment of its
     * name when there is one.
     *
     * @param {string} pageId
     * @param {{ name: string, content: Buffer | string, contentType: string, comment: string }} file
     */
    putAttachment(pageId, { name, content, contentType, comment }) {
      const form = new FormData()
      form.append('file', new Blob([content], { type: contentType }), name)
      form.append('minorEdit', 'true')
      form.append('comment', comment)
      return request(
        'PUT',
        `/wiki/rest/api/content/${pageId}/child/attachment`,
        { form }
      )
    }
  }
}

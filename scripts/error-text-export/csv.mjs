import { COLUMNS } from './rows.mjs'

// The export as CSV (RFC 4180): a header row of COLUMNS' headers, then a row
// for each error ID. UTF-8 with a byte-order mark, which Excel needs to read
// it as UTF-8 rather than show "—" and "…" garbled.

const BYTE_ORDER_MARK = '\uFEFF'
const LINE_END = '\r\n'
const NEEDS_QUOTES = /[",\r\n]/

function field(value) {
  const text = String(value ?? '')
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * @param {Array<Record<string, string>>} rows - from buildRows
 * @param {typeof COLUMNS} [columns]
 * @returns {string}
 */
export function toCsv(rows, columns = COLUMNS) {
  const records = [
    columns.map(({ header }) => header),
    ...rows.map((row) => columns.map(({ key }) => row[key]))
  ]
  const lines = records.map((record) => record.map(field).join(','))
  return `${BYTE_ORDER_MARK}${lines.join(LINE_END)}${LINE_END}`
}

import { COLUMNS } from './rows.mjs'

// The export as CSV (RFC 4180): a header row of COLUMNS' headers, then a row
// for each error ID. UTF-8 with a byte-order mark, which Excel needs to read
// it as UTF-8 rather than show "—" and "…" garbled.
//
// A CSV has no sheet to say where its rows came from, and a line above the
// header would stop it opening as a table, so each row ends with the date,
// branch and commit it was read from.

const BYTE_ORDER_MARK = '﻿'
const LINE_END = '\r\n'
const NEEDS_QUOTES = /[",\r\n]/

/** The columns every row ends with, from the export's meta. */
export const META_COLUMNS = Object.freeze([
  { key: 'date', header: 'Generated' },
  { key: 'branch', header: 'Branch' },
  { key: 'commit', header: 'Commit' }
])

function field(value) {
  const text = String(value ?? '')
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * @param {Array<Record<string, string>>} rows - from buildRows
 * @param {{ date: string, branch: string, commit: string }} meta
 * @param {typeof COLUMNS} [columns]
 * @returns {string}
 */
export function toCsv(rows, meta, columns = COLUMNS) {
  const metaValues = META_COLUMNS.map(({ key }) => meta[key])
  const records = [
    [...columns, ...META_COLUMNS].map(({ header }) => header),
    ...rows.map((row) => [...columns.map(({ key }) => row[key]), ...metaValues])
  ]
  const lines = records.map((record) => record.map(field).join(','))
  return `${BYTE_ORDER_MARK}${lines.join(LINE_END)}${LINE_END}`
}

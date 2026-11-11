import { readFileSync } from 'node:fs'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { META_COLUMNS, toCsv } from './csv.mjs'
import { COLUMNS, buildRows } from './rows.mjs'

/** A CSV's records, read as RFC 4180 says, for checking the writer. */
function parseCsv(text) {
  const records = []
  let record = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
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
    } else if (char === '\r' && text[i + 1] === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      i++
    } else {
      field += char
    }
  }
  return records
}

const columns = [
  { key: 'id', header: 'Error ID' },
  { key: 'text', header: 'Text' }
]

const meta = { date: '2026-11-10', branch: 'main', commit: '39a95e5' }
const metaHeaders = 'Generated,Branch,Commit,Rows'
const metaValues = '2026-11-10,main,39a95e5,codes'

describe('toCsv', () => {
  test('starts with a byte-order mark and ends each record with CRLF', () => {
    const csv = toCsv([{ id: 'A', text: 'x' }], meta, columns)
    expect(csv).toBe(
      `\uFEFFError ID,Text,${metaHeaders}\r\nA,x,${metaValues}\r\n`
    )
  })

  test('quotes a field holding a comma, a quote or a line break', () => {
    const csv = toCsv(
      [{ id: 'A', text: 'Layer "{layer}", line\nnext' }],
      meta,
      columns
    )
    expect(csv).toBe(
      `\uFEFFError ID,Text,${metaHeaders}\r\nA,"Layer ""{layer}"", line\nnext",${metaValues}\r\n`
    )
  })

  test('reads back as the rows it was given, each saying where it came from', () => {
    const rows = buildRows(readFileSync(ERROR_TEXT_FILE, 'utf8'))
    const [header, ...records] = parseCsv(toCsv(rows, meta).slice(1))
    expect(header).toEqual(
      [...COLUMNS, ...META_COLUMNS].map(({ header: name }) => name)
    )
    expect(records).toEqual(
      rows.map((row) => [
        ...COLUMNS.map(({ key }) => row[key]),
        meta.date,
        meta.branch,
        meta.commit,
        'codes'
      ])
    )
  })

  test('names the groups of rows exported, separated by commas', () => {
    const csv = toCsv(
      [{ id: 'A', text: 'x' }],
      {
        ...meta,
        groups: ['codes', 'forms']
      },
      columns
    )
    expect(csv.split('\r\n')[1]).toBe(
      'A,x,2026-11-10,main,39a95e5,"codes, forms"'
    )
  })
})

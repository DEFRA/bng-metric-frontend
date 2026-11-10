import { readFileSync } from 'node:fs'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { toCsv } from './csv.mjs'
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

describe('toCsv', () => {
  test('starts with a byte-order mark and ends each record with CRLF', () => {
    const csv = toCsv([{ id: 'A', text: 'x' }], columns)
    expect(csv).toBe('\uFEFFError ID,Text\r\nA,x\r\n')
  })

  test('quotes a field holding a comma, a quote or a line break', () => {
    const csv = toCsv(
      [{ id: 'A', text: 'Layer "{layer}", line\nnext' }],
      columns
    )
    expect(csv).toBe(
      '\uFEFFError ID,Text\r\nA,"Layer ""{layer}"", line\nnext"\r\n'
    )
  })

  test('reads back as the rows it was given', () => {
    const rows = buildRows(readFileSync(ERROR_TEXT_FILE, 'utf8'))
    const [header, ...records] = parseCsv(toCsv(rows).slice(1))
    expect(header).toEqual(COLUMNS.map(({ header: name }) => name))
    expect(records).toEqual(
      rows.map((row) => COLUMNS.map(({ key }) => row[key]))
    )
  })
})

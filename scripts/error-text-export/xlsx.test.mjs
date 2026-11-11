import ExcelJS from 'exceljs'

import { STATUS } from './rows.mjs'
import { toXlsx } from './xlsx.mjs'

const meta = {
  date: '2026-11-10',
  branch: 'main',
  commit: '39a95e5',
  commitUrl: 'https://github.com/DEFRA/bng-metric-frontend/commit/39a95e5'
}

const columns = [
  { key: 'id', header: 'Error ID', width: 30 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'source', header: 'Source', width: 40 }
]

const rows = [
  { id: 'A', status: STATUS.FINAL, source: 'https://x/f#L1\nhttps://x/f#L9' },
  { id: 'B', status: STATUS.AWAITING_UCD, source: 'https://x/f#L2' }
]

async function read(buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

describe('toXlsx', async () => {
  const workbook = await read(await toXlsx(rows, meta, columns))
  const sheet = workbook.getWorksheet('Error messages')

  test('has a header row, then a row for each error ID', () => {
    expect(sheet.getRow(1).values.slice(1)).toEqual([
      'Error ID',
      'Status',
      'Source'
    ])
    expect(sheet.getRow(2).getCell(1).value).toBe('A')
    expect(sheet.getRow(3).getCell(2).value).toBe(STATUS.AWAITING_UCD)
    expect(sheet.rowCount).toBe(3)
  })

  test('freezes the header row and the error IDs, and filters on every column', () => {
    expect(sheet.views[0]).toMatchObject({
      state: 'frozen',
      xSplit: 1,
      ySplit: 1
    })
    expect(sheet.autoFilter).toBe('A1:C1')
  })

  test('links each row to its first source', () => {
    expect(sheet.getRow(2).getCell(3).value).toEqual({
      text: 'https://x/f#L1\nhttps://x/f#L9',
      hyperlink: 'https://x/f#L1'
    })
  })

  test('says when, and from which commit, it was made', () => {
    const about = workbook.getWorksheet('About')
    expect(about.getRow(1).values.slice(1)).toEqual(['Generated', '2026-11-10'])
    expect(about.getRow(2).values.slice(1)).toEqual(['Branch', 'main'])
    expect(about.getRow(3).getCell(2).value).toEqual({
      text: '39a95e5',
      hyperlink: meta.commitUrl
    })
  })

  test('counts the error IDs, and those with each status', () => {
    const about = workbook.getWorksheet('About')
    const counts = [4, 5, 6, 7].map((n) => about.getRow(n).values.slice(1))
    expect(counts).toEqual([
      ['Error IDs', 2],
      [STATUS.NEEDS_CONTENT, 0],
      [STATUS.AWAITING_UCD, 1],
      [STATUS.FINAL, 1]
    ])
  })
})

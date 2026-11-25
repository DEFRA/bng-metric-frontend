import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { ATTACHMENTS } from './confluence.mjs'
import {
  CHECK_COLUMNS,
  compareWithSheet,
  readSheet
} from './content-design.mjs'
import {
  checkLine,
  contentDesignCheck,
  pageContents,
  publishPage,
  run
} from './publish.mjs'
import { STATUS } from './rows.mjs'

const META = {
  date: '2026-11-25',
  branch: 'main',
  commit: '39a95e5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  commitUrl: 'https://github.com/x/commit/39a95e5',
  fileUrl: 'https://github.com/x/blob/39a95e5/error-text.yaml',
  groups: ['codes']
}

const ROWS = [
  { id: 'NO_REDLINE', status: STATUS.FINAL, body: 'Missing', source: '#L1' }
]

const SHEET =
  'Ref,Problem,Code,Dropout page title (H1),Dropout error subheading (H2),Bodytext,Bodytext (Plural)\n1,No boundary,NO_REDLINE,,,Missing,n/a'

function csvFetch(body, type = 'text/csv') {
  return () =>
    Promise.resolve(new Response(body, { headers: { 'content-type': type } }))
}

describe('contentDesignCheck', () => {
  test('compares the sheet with the rows', async () => {
    const check = await contentDesignCheck(
      'https://x/spreadsheets/d/a/edit',
      ROWS,
      csvFetch(SHEET)
    )
    expect(check.results.map(({ id, check: name }) => [id, name])).toEqual([
      ['NO_REDLINE', 'Matches']
    ])
    expect(checkLine(check)).toBe('Content design check: 1 Matches.')
  })

  test('gives why, rather than failing, when the sheet cannot be read', async () => {
    const check = await contentDesignCheck(
      'https://x/spreadsheets/d/a/edit',
      ROWS,
      csvFetch('<html>', 'text/html')
    )
    expect(check.error).toContain('may no longer be shared')
    expect(checkLine(check)).toContain('was not compared')
  })

  test('compares nothing without a sheet', async () => {
    expect(await contentDesignCheck(undefined, ROWS)).toEqual({})
    expect(checkLine({})).toContain('CONTENT_DESIGN_SHEET_URL is not set')
  })
})

describe('publishPage', () => {
  test('attaches the files, sets the page’s properties, then puts its body as the next version', async () => {
    const calls = []
    const client = {
      getPage: (id) => {
        calls.push(['getPage', id])
        return Promise.resolve({ title: 'Error codes', version: { number: 7 } })
      },
      putAttachment: (id, file) => {
        calls.push(['putAttachment', id, file])
        return Promise.resolve({})
      },
      setPageProperty: (id, key, value) => {
        calls.push(['setPageProperty', id, key, value])
        return Promise.resolve(false)
      },
      updatePage: (id, update) => {
        calls.push(['updatePage', id, update])
        return Promise.resolve({
          version: { number: 8 },
          _links: { base: 'https://s/wiki', webui: '/pages/1' }
        })
      }
    }
    const results = compareWithSheet(readSheet(SHEET), ROWS)
    const contents = await pageContents(META, { results }, ROWS)
    const published = await publishPage(client, '1', contents, META)

    const message = 'Generated from main at 39a95e5'
    const named = (detail) =>
      typeof detail === 'string' ? detail : detail?.name
    expect(calls.map(([name, , detail]) => [name, named(detail)])).toEqual([
      ['getPage', undefined],
      ['putAttachment', ATTACHMENTS.XLSX],
      ['putAttachment', ATTACHMENTS.CSV],
      ['putAttachment', ATTACHMENTS.CHECK_CSV],
      ['setPageProperty', 'content-appearance-published'],
      ['setPageProperty', 'content-appearance-draft'],
      ['setPageProperty', 'editor'],
      ['updatePage', undefined]
    ])

    const files = calls.filter(([name]) => name === 'putAttachment')
    expect(files.every(([, , file]) => file.comment === message)).toBe(true)
    expect(files[0][2].content.length).toBeGreaterThan(0)
    expect(files[1][2].content).toContain('NO_REDLINE')
    const checkCsv = files[2][2].content.split('\r\n')
    expect(checkCsv[0]).toContain(
      CHECK_COLUMNS.map(({ header }) => header).join(',')
    )
    expect(checkCsv[1]).toMatch(/^1,NO_REDLINE,Matches,Final,No boundary,/)

    const [, , update] = calls.at(-1)
    expect(update).toMatchObject({ title: 'Error codes', version: 7, message })
    expect(update.body).toContain('NO_REDLINE')
    expect(update.body).toContain('Edits made here will be overwritten')
    expect(published).toEqual({ version: 8, url: 'https://s/wiki/pages/1' })
  })
})

describe('run', () => {
  const SHA = '39a95e5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const SETTINGS = {
    CONFLUENCE_BASE_URL: 'https://s',
    CONFLUENCE_PAGE_ID: '1',
    CONFLUENCE_EMAIL: 'a@b',
    CONFLUENCE_API_TOKEN: 't'
  }
  const noRequests = () => {
    throw new Error('sent a request')
  }

  test('refuses a branch other than main', async () => {
    await expect(
      run(['--branch', 'feature', '--sha', SHA], {
        env: SETTINGS,
        fetchImpl: noRequests,
        isOnMain: () => true
      })
    ).rejects.toThrow('Only main is published, not feature')
  })

  test('refuses a commit that is not on origin/main, whatever --branch says', async () => {
    await expect(
      run(['--branch', 'main', '--sha', SHA], {
        env: SETTINGS,
        fetchImpl: noRequests,
        isOnMain: () => false
      })
    ).rejects.toThrow('39a95e5 is not on origin/main')
  })

  test('refuses to publish without the Confluence settings', async () => {
    await expect(
      run(['--branch', 'main', '--sha', SHA], {
        env: { CONFLUENCE_BASE_URL: 'https://s' },
        fetchImpl: noRequests,
        isOnMain: () => true
      })
    ).rejects.toThrow(
      'Set CONFLUENCE_PAGE_ID, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN to publish'
    )
  })

  test('with --dry-run, writes the page and its files and sends nothing, on any branch', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'publish-'))
    try {
      await run(['--dry-run', dir, '--branch', 'feature', '--sha', SHA], {
        env: {},
        fetchImpl: noRequests,
        isOnMain: () => false
      })
      expect(readdirSync(dir).sort()).toEqual(
        [...Object.values(ATTACHMENTS), 'confluence-page.xml'].sort()
      )
      expect(
        readFileSync(path.join(dir, 'confluence-page.xml'), 'utf8')
      ).toContain('Sheet not read')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

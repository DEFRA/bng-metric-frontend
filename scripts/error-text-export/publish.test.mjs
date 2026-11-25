import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { load } from 'js-yaml'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { ATTACHMENTS, pageBody } from './confluence.mjs'
import {
  CHECK_COLUMNS,
  compareWithSheet,
  readSheet
} from './content-design.mjs'
import {
  checkLine,
  contentDesignCheck,
  pageContents,
  commitIsOnMain,
  contentFingerprint,
  publishPage,
  run,
  sourceAt
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
      ['putAttachment', ATTACHMENTS.SHEET_LAYOUT_CSV],
      ['setPageProperty', 'content-appearance-published'],
      ['setPageProperty', 'content-appearance-draft'],
      ['setPageProperty', 'editor'],
      ['updatePage', undefined]
    ])

    const files = calls.filter(([name]) => name === 'putAttachment')
    expect(files.every(([, , file]) => file.comment === message)).toBe(true)
    expect(files[0][2].content.length).toBeGreaterThan(0)
    expect(files[1][2].content).toContain('NO_REDLINE')
    const sheetLayout = files[3][2].content.split('\r\n')
    expect(sheetLayout[0]).toContain(
      'Error category,Ref,Problem,Code,When checked,Dropout page title (H1)'
    )
    expect(sheetLayout[1]).toMatch(
      /,1,No boundary,NO_REDLINE,.*,Missing,.*,Matches,Final,/
    )
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

/** A client whose calls are recorded, each as it starts and ends. */
function recordingClient({ attachment } = {}) {
  const calls = []
  const client = {
    getPage: () => Promise.resolve({ title: 'T', version: { number: 1 } }),
    putAttachment: async (id, file) => {
      calls.push(`attach ${file.name}`)
      await (attachment ? attachment(file) : Promise.resolve())
      calls.push(`attached ${file.name}`)
    },
    setPageProperty: () => Promise.resolve(false),
    updatePage: () => {
      calls.push('update')
      return Promise.resolve({ version: { number: 2 } })
    }
  }
  return { calls, client }
}

describe('publishPage, as its uploads finish', () => {
  test('puts the page only once every file has been attached', async () => {
    let release
    const pending = new Promise((resolve) => {
      release = resolve
    })
    const { calls, client } = recordingClient({
      attachment: (file) =>
        file.name === ATTACHMENTS.CHECK_CSV ? pending : Promise.resolve()
    })
    const contents = await pageContents(META, { results: [] }, ROWS)
    const publishing = publishPage(client, '1', contents, META)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(calls).not.toContain('update')
    release()
    await publishing
    expect(calls.at(-1)).toBe('update')
    expect(calls.indexOf('update')).toBeGreaterThan(
      calls.indexOf(`attached ${ATTACHMENTS.CHECK_CSV}`)
    )
  })

  test('never puts the page when an upload fails', async () => {
    const { calls, client } = recordingClient({
      attachment: (file) =>
        file.name === ATTACHMENTS.CSV
          ? Promise.reject(new Error('upload failed'))
          : Promise.resolve()
    })
    const contents = await pageContents(META, { results: [] }, ROWS)
    await expect(publishPage(client, '1', contents, META)).rejects.toThrow(
      'upload failed'
    )
    expect(calls).not.toContain('update')
  })
})

describe('publishPage, when the page already shows the same', () => {
  function client(fingerprint) {
    const calls = []
    return {
      calls,
      getPage: () => Promise.resolve({ title: 'T', version: { number: 4 } }),
      getPageProperty: (id, key) => {
        calls.push(`get ${key}`)
        return Promise.resolve({ value: fingerprint })
      },
      putAttachment: () => {
        calls.push('attach')
        return Promise.resolve()
      },
      setPageProperty: (id, key) => {
        calls.push(`set ${key}`)
        return Promise.resolve(true)
      },
      updatePage: () => {
        calls.push('update')
        return Promise.resolve({ version: { number: 5 } })
      }
    }
  }

  test('leaves the page alone', async () => {
    const same = client('abc')
    const contents = await pageContents(META, { results: [] }, ROWS)
    await expect(
      publishPage(same, '1', contents, META, { fingerprint: 'abc' })
    ).resolves.toEqual({ version: 4, url: '', unchanged: true })
    expect(same.calls).toEqual(['get bng-error-text-fingerprint'])
  })

  test('marks the page incomplete until every change is made, so a failed publish is redone', async () => {
    const stored = { value: 'abc' }
    const calls = []
    let failUpload = true
    const flaky = {
      getPage: () => Promise.resolve({ title: 'T', version: { number: 4 } }),
      getPageProperty: () => Promise.resolve({ ...stored }),
      setPageProperty: (id, key, value) => {
        calls.push(`set ${value}`)
        stored.value = value
        return Promise.resolve(true)
      },
      putAttachment: () =>
        failUpload
          ? Promise.reject(new Error('upload failed'))
          : Promise.resolve(),
      updatePage: () => {
        calls.push('update')
        return Promise.resolve({ version: { number: 5 } })
      }
    }
    const contents = await pageContents(META, { results: [] }, ROWS)

    // A run with new content fails part way through its uploads.
    await expect(
      publishPage(flaky, '1', contents, META, { fingerprint: 'new' })
    ).rejects.toThrow('upload failed')
    expect(stored.value).toBe('incomplete')

    // The next run, back to the original content, is not skipped.
    failUpload = false
    await publishPage(flaky, '1', contents, META, { fingerprint: 'abc' })
    // The page's own properties aside: only the fingerprint is followed here.
    const fingerprintCalls = calls.filter(
      (call) => call === 'update' || /^set (incomplete|abc|new)$/.test(call)
    )
    expect(fingerprintCalls).toEqual([
      'set incomplete',
      'set incomplete',
      'update',
      'set abc'
    ])
    expect(stored.value).toBe('abc')
  })

  test('keeps the page incomplete while its update is pending or fails, and retries it', async () => {
    const stored = { value: 'old' }
    const updates = []
    const flaky = {
      getPage: () => Promise.resolve({ title: 'T', version: { number: 4 } }),
      getPageProperty: () => Promise.resolve({ ...stored }),
      setPageProperty: (id, key, value) => {
        if (key === 'bng-error-text-fingerprint') {
          stored.value = value
        }
        return Promise.resolve(true)
      },
      putAttachment: () => Promise.resolve(),
      updatePage: () => {
        let settle
        const pending = new Promise((resolve, reject) => {
          settle = { resolve, reject }
        })
        updates.push(settle)
        return pending
      }
    }
    const contents = await pageContents(META, { results: [] }, ROWS)
    const settled = () => new Promise((resolve) => setTimeout(resolve, 10))

    // The update is pending: the page is not yet marked as showing 'new'.
    const failing = publishPage(flaky, '1', contents, META, {
      fingerprint: 'new'
    })
    await settled()
    expect(updates).toHaveLength(1)
    expect(stored.value).toBe('incomplete')

    // The update fails: the page stays incomplete.
    updates[0].reject(new Error('update failed'))
    await expect(failing).rejects.toThrow('update failed')
    expect(stored.value).toBe('incomplete')

    // The next run with the same content is not skipped, and retries it.
    const retry = publishPage(flaky, '1', contents, META, {
      fingerprint: 'new'
    })
    await settled()
    expect(updates).toHaveLength(2)
    updates[1].resolve({ version: { number: 5 } })
    await retry
    expect(stored.value).toBe('new')
  })

  test('publishes it anyway when forced, and keeps the new fingerprint', async () => {
    const same = client('abc')
    const contents = await pageContents(META, { results: [] }, ROWS)
    await publishPage(same, '1', contents, META, {
      fingerprint: 'abc',
      force: true
    })
    expect(same.calls).toContain('update')
    expect(same.calls.at(-1)).toBe('set bng-error-text-fingerprint')
  })

  test('publishes it when the fingerprint differs', async () => {
    const other = client('old')
    const contents = await pageContents(META, { results: [] }, ROWS)
    await publishPage(other, '1', contents, META, { fingerprint: 'new' })
    expect(other.calls).toContain('update')
  })
})

describe('contentFingerprint', () => {
  const at = (commit) =>
    ROWS.map((row) => ({ ...row, source: `https://x/blob/${commit}#L1` }))

  test('is the same for two commits that show the same', () => {
    expect(contentFingerprint(at('aaa'), {})).toBe(
      contentFingerprint(at('bbb'), {})
    )
  })

  test('is the same for two commits’ sheet comparisons that say the same', () => {
    const sheet = readSheet(SHEET)
    const check = (commit) => ({ results: compareWithSheet(sheet, at(commit)) })
    expect(check('aaa').results[0].source).not.toBe(
      check('bbb').results[0].source
    )
    expect(contentFingerprint(at('aaa'), check('aaa'))).toBe(
      contentFingerprint(at('bbb'), check('bbb'))
    )
  })

  test('differs when the export’s own code changes, though no message does', () => {
    expect(contentFingerprint(ROWS, {}, 'one layout')).not.toBe(
      contentFingerprint(ROWS, {}, 'another layout')
    )
  })

  test('takes in the export’s code as it is on disk by default', () => {
    expect(contentFingerprint(ROWS, {})).not.toBe(
      contentFingerprint(ROWS, {}, '')
    )
  })

  test('differs when a message changes', () => {
    const reworded = at('aaa').map((row) => ({ ...row, body: 'Gone' }))
    expect(contentFingerprint(reworded, {})).not.toBe(
      contentFingerprint(at('aaa'), {})
    )
  })

  test('differs when only a column the attachments alone have changes', () => {
    const results = compareWithSheet(readSheet(SHEET), ROWS)
    const changed = (cells) =>
      contentFingerprint(
        ROWS.map((row) => ({ ...row, ...cells })),
        { results }
      )
    const before = contentFingerprint(ROWS, { results })
    expect(results[0].check).toBe('Matches')
    expect(
      changed({ values: '{max}: the most characters allowed (2000)' })
    ).not.toBe(before)
    expect(changed({ inline: 'Enter a shorter comment' })).not.toBe(before)
  })

  test('differs when only a comparison field the check CSV alone has changes', () => {
    const results = compareWithSheet(readSheet(SHEET), ROWS)
    const reworded = results.map((result) => ({
      ...result,
      problem: 'Another problem'
    }))
    expect(pageBody(ROWS, META, { results: reworded })).toBe(
      pageBody(ROWS, META, { results })
    )
    expect(contentFingerprint(ROWS, { results: reworded })).not.toBe(
      contentFingerprint(ROWS, { results })
    )
  })

  test('differs when the sheet’s comparison changes', () => {
    const results = compareWithSheet(readSheet(SHEET), ROWS)
    expect(contentFingerprint(ROWS, { results })).not.toBe(
      contentFingerprint(ROWS, { error: 'HTTP 404' })
    )
  })
})

describe('the git helpers, in a repository of their own', () => {
  const YAML_PATH = 'src/server/common/error-text/error-text.yaml'
  let repository
  let first
  let second
  let divergent

  function git(...args) {
    return execFileSync(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args],
      { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim()
  }

  function commit(words) {
    writeFileSync(path.join(repository, YAML_PATH), words)
    git('add', '.')
    git('commit', '-q', '--no-gpg-sign', '--no-verify', '-m', words)
    return git('rev-parse', 'HEAD')
  }

  beforeAll(() => {
    repository = mkdtempSync(path.join(tmpdir(), 'publish-git-'))
    mkdirSync(path.join(repository, path.dirname(YAML_PATH)), {
      recursive: true
    })
    git('init', '-q', '-b', 'main')
    first = commit('first: words\n')
    second = commit('second: words\n')
    git('checkout', '-q', '-b', 'feature', first)
    divergent = commit('feature: words\n')
  })

  afterAll(() => {
    rmSync(repository, { recursive: true, force: true })
  })

  test('commitIsOnMain accepts a commit on main, and refuses one after it or off it', () => {
    expect(commitIsOnMain(first, second, repository)).toBe(true)
    expect(commitIsOnMain(second, second, repository)).toBe(true)
    expect(commitIsOnMain(second, first, repository)).toBe(false)
    expect(commitIsOnMain(divergent, second, repository)).toBe(false)
    expect(
      commitIsOnMain(
        '0000000000000000000000000000000000000000',
        second,
        repository
      )
    ).toBe(false)
  })

  test('sourceAt gives each commit’s own error-text.yaml', () => {
    expect(sourceAt(first, repository)).toBe('first: words\n')
    expect(sourceAt(second, repository)).toBe('second: words\n')
    expect(sourceAt(divergent, repository)).toBe('feature: words\n')
    expect(() =>
      sourceAt('0000000000000000000000000000000000000000', repository)
    ).toThrow()
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

  // error-text.yaml as a commit has it, worded unlike the working tree.
  const WORKING_TREE = readFileSync(ERROR_TEXT_FILE, 'utf8')
  const WORKING_TITLE = 'There is a problem with your file'
  const COMMITTED_TITLE = 'Committed wording only'
  const COMMITTED = WORKING_TREE.replaceAll(WORKING_TITLE, COMMITTED_TITLE)

  test('publishes the commit’s wording, and summarises it with counts but none of the sheet’s words', async () => {
    expect(WORKING_TREE).toContain(WORKING_TITLE)
    const requests = []
    let pageBody
    const fetchImpl = async (url, init = {}) => {
      requests.push(`${init.method ?? 'GET'} ${url}`)
      if (url.endsWith('/wiki/api/v2/pages/1') && init.method === 'PUT') {
        pageBody = JSON.parse(init.body).body.value
      }
      if (url.startsWith('https://docs.google.com/')) {
        return new Response(
          `${SHEET}\n2,Secret,UNKNOWN_CODE_X,,,Wording only UCD has,,`,
          { headers: { 'content-type': 'text/csv' } }
        )
      }
      if (url.includes('/properties')) {
        return Response.json({
          results: [
            {
              id: '9',
              value: url.endsWith('editor') ? 'v2' : 'max',
              version: { number: 1 }
            }
          ]
        })
      }
      if (url.endsWith('/wiki/api/v2/pages/1') && init.method === 'PUT') {
        return Response.json({
          version: { number: 6 },
          _links: { base: 'https://s/wiki', webui: '/p/1' }
        })
      }
      if (url.endsWith('/wiki/api/v2/pages/1')) {
        return Response.json({ title: 'T', version: { number: 5 } })
      }
      return Response.json({ results: [] })
    }
    const dir = mkdtempSync(path.join(tmpdir(), 'publish-'))
    const summary = path.join(dir, 'summary.md')
    try {
      const read = []
      await run(['--branch', 'main', '--sha', SHA, '--summary', summary], {
        env: {
          ...SETTINGS,
          CONTENT_DESIGN_SHEET_URL:
            'https://docs.google.com/spreadsheets/d/abc/edit#gid=1'
        },
        fetchImpl,
        isOnMain: () => true,
        readCommit: (commit) => {
          read.push(commit)
          return COMMITTED
        }
      })
      expect(read).toEqual([SHA])
      expect(pageBody).toContain(COMMITTED_TITLE)
      expect(pageBody).not.toContain(WORKING_TITLE)
      expect(requests).toEqual([
        'GET https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=1',
        'GET https://s/wiki/api/v2/pages/1',
        'GET https://s/wiki/api/v2/pages/1/properties?key=bng-error-text-fingerprint',
        'GET https://s/wiki/api/v2/pages/1/properties?key=bng-error-text-fingerprint',
        'PUT https://s/wiki/api/v2/pages/1/properties/9',
        'PUT https://s/wiki/rest/api/content/1/child/attachment',
        'PUT https://s/wiki/rest/api/content/1/child/attachment',
        'PUT https://s/wiki/rest/api/content/1/child/attachment',
        'PUT https://s/wiki/rest/api/content/1/child/attachment',
        'GET https://s/wiki/api/v2/pages/1/properties?key=content-appearance-published',
        'GET https://s/wiki/api/v2/pages/1/properties?key=content-appearance-draft',
        'GET https://s/wiki/api/v2/pages/1/properties?key=editor',
        'PUT https://s/wiki/api/v2/pages/1',
        'GET https://s/wiki/api/v2/pages/1/properties?key=bng-error-text-fingerprint',
        'PUT https://s/wiki/api/v2/pages/1/properties/9'
      ])
      const written = readFileSync(summary, 'utf8')
      expect(written).toContain(
        'to Confluence ([version 6](https://s/wiki/p/1)).'
      )
      expect(written).toMatch(/Content design check: .*1 Not in service/)
      expect(written).not.toContain('Wording only UCD has')
      expect(written).not.toContain('UNKNOWN_CODE_X')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('refuses a commit whose error-text.yaml the service would refuse, and sends nothing', async () => {
    // A JSON document is YAML: a form message with a summary and no inline
    // message, which the service refuses at start-up.
    const value = load(WORKING_TREE)
    const [field] = Object.keys(value.forms)
    const [rule] = Object.keys(value.forms[field])
    value.forms[field][rule] = { summary: 'Only a summary' }
    await expect(
      run(['--branch', 'main', '--sha', SHA], {
        env: SETTINGS,
        fetchImpl: noRequests,
        isOnMain: () => true,
        readCommit: () => JSON.stringify(value)
      })
    ).rejects.toThrow(
      `error-text.yaml is not valid: "forms.${field}.${rule}" contains [summary] without its required peers [inline]`
    )
  })

  test('with --dry-run, writes the page and its files and sends nothing, on any branch', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'publish-'))
    try {
      await run(['--dry-run', dir, '--branch', 'feature', '--sha', SHA], {
        env: {},
        fetchImpl: noRequests,
        isOnMain: () => false,
        readCommit: () => {
          throw new Error('read a commit')
        }
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

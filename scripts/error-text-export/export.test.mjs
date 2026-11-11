import { execFileSync } from 'node:child_process'
import {
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
import {
  checkErrorText,
  exportMeta,
  fileStem,
  summaryMarkdown,
  writeExport
} from './export.mjs'
import { STATUS } from './rows.mjs'

const NOW = new Date('2026-11-10T09:00:00Z')
const SHA = '39a95e5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const SOURCE = readFileSync(ERROR_TEXT_FILE, 'utf8')

/** error-text.yaml with its first upload error's whenAlone misspelt. */
function withBrokenUploadError() {
  const value = load(SOURCE)
  const [code] = Object.keys(value.upload.errors)
  value.upload.errors[code].whenAlone = 'catch_all'
  // JSON is YAML, so the export reads it as it reads the file.
  return { code, source: JSON.stringify(value) }
}

describe('fileStem', () => {
  test('names the date, branch and short commit', () => {
    expect(fileStem({ date: '2026-11-10', branch: 'main', commit: SHA })).toBe(
      'error-messages-2026-11-10-main-39a95e5'
    )
  })

  test('replaces a slash in a branch name', () => {
    expect(
      fileStem({ date: '2026-11-10', branch: 'feature/a b', commit: SHA })
    ).toBe('error-messages-2026-11-10-feature-a-b-39a95e5')
  })
})

describe('exportMeta', () => {
  test('reads the commit, branch and repository from GitHub Actions', () => {
    const env = {
      GITHUB_SHA: SHA,
      GITHUB_REF_NAME: 'main',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'DEFRA/bng-metric-frontend'
    }
    expect(exportMeta({}, env, NOW)).toEqual({
      repository: 'https://github.com/DEFRA/bng-metric-frontend',
      date: '2026-11-10',
      branch: 'main',
      commit: SHA,
      commitUrl: `https://github.com/DEFRA/bng-metric-frontend/commit/${SHA}`,
      fileUrl: `https://github.com/DEFRA/bng-metric-frontend/blob/${SHA}/src/server/common/error-text/error-text.yaml`
    })
  })

  test('names a pull request by its branch, not its merge ref', () => {
    const env = {
      GITHUB_SHA: SHA,
      GITHUB_HEAD_REF: 'BMD-1204-x',
      GITHUB_REF_NAME: '488/merge'
    }
    expect(exportMeta({}, env, NOW).branch).toBe('BMD-1204-x')
  })

  test('takes the commit and branch it is given over the environment', () => {
    const meta = exportMeta(
      { sha: 'abc1234', branch: 'mine' },
      { GITHUB_SHA: SHA },
      NOW
    )
    expect(meta).toMatchObject({ commit: 'abc1234', branch: 'mine' })
  })
})

describe('checkErrorText', () => {
  test('accepts error-text.yaml', () => {
    expect(() => checkErrorText(SOURCE)).not.toThrow()
  })

  test('refuses an upload error the server would refuse, naming it', () => {
    const { code, source } = withBrokenUploadError()
    expect(() => checkErrorText(source)).toThrow(
      new RegExp(`upload section is not valid: .*${code}\\.whenAlone`)
    )
  })
})

describe('writeExport', () => {
  let outDir

  beforeEach(() => {
    outDir = mkdtempSync(path.join(tmpdir(), 'error-text-export-'))
  })

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  test('writes the .xlsx, .csv and .html, with links to the commit', async () => {
    const meta = exportMeta({ sha: SHA, branch: 'main' }, {}, NOW)
    const { rows, files } = await writeExport(SOURCE, outDir, meta)

    expect(readdirSync(outDir).sort()).toEqual([
      'error-messages-2026-11-10-main-39a95e5.csv',
      'error-messages-2026-11-10-main-39a95e5.html',
      'error-messages-2026-11-10-main-39a95e5.xlsx'
    ])
    expect(files).toHaveLength(3)
    expect(rows[0].source).toMatch(
      new RegExp(`^${meta.fileUrl.replaceAll('.', '\\.')}#L\\d+$`)
    )
  })

  test('writes nothing for a file the server would refuse', async () => {
    const meta = exportMeta({ sha: SHA, branch: 'main' }, {}, NOW)
    await expect(
      writeExport(withBrokenUploadError().source, outDir, meta)
    ).rejects.toThrow('upload section is not valid')
    expect(readdirSync(outDir)).toEqual([])
  })
})

describe('summaryMarkdown', () => {
  test('names where the export came from, and counts each status', () => {
    const meta = exportMeta({ sha: SHA, branch: 'main' }, {}, NOW)
    const rows = [
      { status: STATUS.FINAL },
      { status: STATUS.FINAL },
      { status: STATUS.AWAITING_UCD }
    ]
    const files = ['/out/a.xlsx', '/out/a.csv']
    expect(summaryMarkdown(rows, meta, files).split('\n')).toEqual([
      '## Error messages export',
      '',
      `3 error IDs from \`main\` at [39a95e5](${meta.commitUrl}), exported 2026-11-10.`,
      '',
      '| Status | Error IDs |',
      '| --- | ---: |',
      `| ${STATUS.NEEDS_CONTENT} | 0 |`,
      `| ${STATUS.AWAITING_UCD} | 1 |`,
      `| ${STATUS.FINAL} | 2 |`,
      '',
      'Files: `a.xlsx`, `a.csv`',
      ''
    ])
  })
})

describe('npm run export:error-text -- --summary', () => {
  const script = path.join(import.meta.dirname, 'export.mjs')
  // Two runs of the script, each loading the server's modules.
  const TWO_RUNS_TIMEOUT_MS = 20_000
  let dir

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'error-text-export-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function run(summary, ...more) {
    execFileSync(
      process.execPath,
      [
        script,
        '--out',
        dir,
        '--sha',
        SHA,
        '--branch',
        'main',
        '--summary',
        summary,
        ...more
      ],
      { stdio: 'pipe' }
    )
  }

  test(
    'appends the summary to the file, keeping what it held',
    () => {
      const summary = path.join(dir, 'summary.md')
      writeFileSync(summary, 'Earlier step\n')

      run(summary)
      run(summary)

      const text = readFileSync(summary, 'utf8')
      expect(text.startsWith('Earlier step\n## Error messages export\n')).toBe(
        true
      )
      expect(text.match(/^## Error messages export$/gm)).toHaveLength(2)
    },
    TWO_RUNS_TIMEOUT_MS
  )

  test(
    'with --base, adds what the wording changes from that commit',
    () => {
      const summary = path.join(dir, 'summary.md')

      run(summary, '--base', 'HEAD')

      expect(readFileSync(summary, 'utf8')).toMatch(
        // What follows depends on any edit to the file not yet committed.
        // The repository's URL comes from GitHub Actions when it runs there.
        /\n### Wording changes from \[[0-9a-f]{7}\]\(https:\/\/[^)]+\/commit\/[0-9a-f]{40}\)\n/
      )
    },
    TWO_RUNS_TIMEOUT_MS
  )

  test(
    'keeps the export, and says why, when git cannot find the base',
    () => {
      const summary = path.join(dir, 'summary.md')

      run(summary, '--base', 'no-such-ref')

      expect(
        readdirSync(dir).filter((name) => name.endsWith('.xlsx'))
      ).toHaveLength(1)
      expect(readFileSync(summary, 'utf8')).toContain(
        '### Wording changes from `no-such-ref`\n\nThe changes are not shown: git cannot find that commit.\n'
      )
    },
    TWO_RUNS_TIMEOUT_MS
  )
})

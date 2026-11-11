import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { load } from 'js-yaml'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { checkErrorText, exportMeta, fileStem, writeExport } from './export.mjs'

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

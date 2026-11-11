import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  ERROR_TEXT_FILE,
  parseErrorText
} from '../../src/server/common/error-text/error-text.js'
import { checkDropoutCopy } from '../../src/server/error-file/dropout-copy.js'
import { toCsv } from './csv.mjs'
import { compareWithBase } from './diff.mjs'
import { toHtml } from './html.mjs'
import { buildRows, statusCounts } from './rows.mjs'
import { toXlsx } from './xlsx.mjs'

// npm run export:error-text [-- --out DIR] [--sha SHA] [--branch NAME]
//   [--summary FILE] [--base REF]
//
// Writes every message in error-text.yaml as .xlsx, .csv and .html, for
// product, BAs and UCD to review. The file is checked as the server checks it
// at start-up, the upload section included, so a file the server would refuse
// is not exported, and the message says which entry is wrong.
//
// Each row links to its line of the file at the commit it was read from: by
// default the one checked out, or in GitHub Actions GITHUB_SHA. A pull
// request's run passes --sha its head commit, as its merge commit has no
// lasting URL.
//
// --summary appends what was exported, as Markdown, to a file: in GitHub
// Actions, the run's job summary. --base adds what the checked-out file
// changes from the file at another commit: for a pull request, the commit
// its branch left main at.

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
// error-text.yaml's path from the repository's root, as git names it.
const ERROR_TEXT_PATH = path
  .relative(REPO_ROOT, ERROR_TEXT_FILE)
  .split(path.sep)
  .join('/')
const DEFAULT_OUT = 'export'
const DEFAULT_REPOSITORY = 'https://github.com/DEFRA/bng-metric-frontend'
const SHORT_SHA_LENGTH = 7
const DATE_LENGTH = 10

const USAGE = `Usage: npm run export:error-text [-- options]

  --out DIR        where to write the files (default: ${DEFAULT_OUT})
  --sha SHA        the commit the source links name (default: GITHUB_SHA, or HEAD)
  --branch NAME    the branch the files are named for (default: the GitHub ref, or the current branch)
  --summary FILE   append what was exported, as Markdown, to FILE
  --base REF       also say what the wording changes from the file at REF
  --help           show this message`

function git(...args) {
  // stderr is kept, not printed: a failure's message carries it.
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

/** A branch name as part of a file name: "feature/x" as "feature-x". */
function safeBranch(branch) {
  return branch.replaceAll(/[^\w.-]+/g, '-')
}

/**
 * Each file's name, but for its extension:
 * error-messages-2026-11-10-main-39a95e5.
 *
 * @param {{ date: string, branch: string, commit: string }} meta
 */
export function fileStem({ date, branch, commit }) {
  return `error-messages-${date}-${safeBranch(branch)}-${commit.slice(0, SHORT_SHA_LENGTH)}`
}

/**
 * Which commit and branch the export is read from, and its date.
 *
 * @param {{ sha?: string, branch?: string }} options
 * @param {NodeJS.ProcessEnv} [env]
 * @param {Date} [now]
 */
export function exportMeta(options, env = process.env, now = new Date()) {
  const repository =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`
      : DEFAULT_REPOSITORY
  const commit = options.sha || env.GITHUB_SHA || git('rev-parse', 'HEAD')
  const branch =
    options.branch ||
    env.GITHUB_HEAD_REF ||
    env.GITHUB_REF_NAME ||
    git('rev-parse', '--abbrev-ref', 'HEAD')
  return {
    repository,
    date: now.toISOString().slice(0, DATE_LENGTH),
    branch,
    commit,
    commitUrl: `${repository}/commit/${commit}`,
    fileUrl: `${repository}/blob/${commit}/${ERROR_TEXT_PATH}`
  }
}

/**
 * Refuse a file the server would refuse to start with.
 *
 * @param {string} source - error-text.yaml's text
 */
export function checkErrorText(source) {
  checkDropoutCopy(parseErrorText(source).upload)
}

/**
 * Write the three files into `outDir`.
 *
 * @param {string} source - error-text.yaml's text
 * @param {string} outDir
 * @param {ReturnType<typeof exportMeta>} meta
 * @returns {Promise<{ rows: Array<Record<string, string>>, files: string[] }>}
 */
export async function writeExport(source, outDir, meta) {
  checkErrorText(source)
  const rows = buildRows(source, {
    sourceUrl: (line) => `${meta.fileUrl}#L${line}`
  })
  const stem = path.join(outDir, fileStem(meta))
  const contents = {
    xlsx: await toXlsx(rows, meta),
    csv: toCsv(rows, meta),
    html: toHtml(rows, meta)
  }
  mkdirSync(outDir, { recursive: true })
  const files = Object.entries(contents).map(([extension, content]) => {
    const file = `${stem}.${extension}`
    writeFileSync(file, content)
    return file
  })
  return { rows, files }
}

/**
 * What was exported, as Markdown: where from, and how many error IDs have
 * each status.
 *
 * @param {Array<{ status: string }>} rows
 * @param {ReturnType<typeof exportMeta>} meta
 * @param {string[]} files
 * @returns {string}
 */
export function summaryMarkdown(rows, meta, files) {
  const counts = Object.entries(statusCounts(rows)).map(
    ([status, count]) => `| ${status} | ${count} |`
  )
  const names = files.map((file) => `\`${path.basename(file)}\``).join(', ')
  const commit = `[${meta.commit.slice(0, SHORT_SHA_LENGTH)}](${meta.commitUrl})`
  return [
    '## Error messages export',
    '',
    `${rows.length} error IDs from \`${meta.branch}\` at ${commit}, exported ${meta.date}.`,
    '',
    '| Status | Error IDs |',
    '| --- | ---: |',
    ...counts,
    '',
    `Files: ${names}`,
    ''
  ].join('\n')
}

/** error-text.yaml's text at a commit, or null when it has no such file. */
function sourceAt(commit) {
  try {
    return git('show', `${commit}:${ERROR_TEXT_PATH}`)
  } catch {
    return null
  }
}

/**
 * What the wording changes from the file at `ref`, as Markdown.
 *
 * @param {Array<Record<string, string>>} rows - the export's rows
 * @param {string} ref - a commit, branch or tag
 * @param {ReturnType<typeof exportMeta>} meta
 */
function baseMarkdown(rows, ref, meta) {
  const commit = git('rev-parse', '--verify', `${ref}^{commit}`)
  const link = `[${commit.slice(0, SHORT_SHA_LENGTH)}](${meta.repository}/commit/${commit})`
  return compareWithBase(rows, sourceAt(commit), link)
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: DEFAULT_OUT },
      sha: { type: 'string' },
      branch: { type: 'string' },
      summary: { type: 'string' },
      base: { type: 'string' },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help) {
    console.log(USAGE)
    return
  }

  const meta = exportMeta(values)
  console.log(
    `Exporting ${path.relative(REPO_ROOT, ERROR_TEXT_FILE)} at ${meta.branch} ${meta.commit.slice(0, SHORT_SHA_LENGTH)}`
  )
  const { rows, files } = await writeExport(
    readFileSync(ERROR_TEXT_FILE, 'utf8'),
    path.resolve(values.out),
    meta
  )
  for (const file of files) {
    console.log(`Wrote ${path.relative(process.cwd(), file)}`)
  }
  const counts = Object.entries(statusCounts(rows))
    .map(([status, count]) => `${count} ${status}`)
    .join(', ')
  console.log(`${rows.length} error IDs: ${counts}`)
  const summary = [summaryMarkdown(rows, meta, files)]
  if (values.base) {
    summary.push(baseMarkdown(rows, values.base, meta))
  }
  if (values.summary) {
    appendFileSync(values.summary, summary.join('\n'))
    console.log(`Appended the summary to ${values.summary}`)
  } else if (values.base) {
    console.log(`\n${summary.at(-1)}`)
  }
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

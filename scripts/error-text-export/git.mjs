import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'

// What the export and the publish read from git: the repository's root,
// error-text.yaml at a commit, and a commit's short form.

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
export const SHORT_SHA_LENGTH = 7

// error-text.yaml's path from the repository's root, as git names it.
export const ERROR_TEXT_PATH = path
  .relative(REPO_ROOT, ERROR_TEXT_FILE)
  .split(path.sep)
  .join('/')

/**
 * error-text.yaml as it is at `commit`. Throws when git has no such commit,
 * or the commit has no such file.
 *
 * @param {string} commit
 * @param {string} [repository] - the repository's folder
 * @returns {string}
 */
export function sourceAt(commit, repository = REPO_ROOT) {
  // stderr is kept, not printed: a failure's message carries it.
  return execFileSync('git', ['show', `${commit}:${ERROR_TEXT_PATH}`], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

// ESLint does not read templates, so this does its job for them: error text
// a template writes out itself, rather than showing what its page gives it
// from error-text.yaml.
const SERVER_DIR = path.resolve(import.meta.dirname, '../..')
const WRITTEN_IN = [
  ['an inline error message', /errorMessage:\s*\{\s*text:\s*["']/],
  ["an error summary's title", /titleText:\s*["']/]
]

const templates = globSync('**/*.njk', { cwd: SERVER_DIR })

describe('templates', () => {
  test('there are templates to check', () => {
    expect(templates.length).toBeGreaterThan(0)
  })

  test.each(WRITTEN_IN)('write no %s of their own', (_, pattern) => {
    const writing = templates.filter((file) =>
      pattern.test(readFileSync(path.join(SERVER_DIR, file), 'utf8'))
    )
    expect(writing).toEqual([])
  })
})

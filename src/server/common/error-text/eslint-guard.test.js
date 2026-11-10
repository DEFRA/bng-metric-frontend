import path from 'node:path'

import { ESLint } from 'eslint'

// eslint.config.js refuses error text written into the code. Each case is
// linted as a file in src/, where the rule applies, so a selector that stops
// matching what it is for fails here.
const ROOT = path.resolve(import.meta.dirname, '../../../..')
const FILE = path.join(ROOT, 'src/server/eslint-guard-sample.js')
const RULE = 'no-restricted-syntax'

const eslint = new ESLint({ cwd: ROOT })

async function restrictedLines(code) {
  const [result] = await eslint.lintText(code, { filePath: FILE })
  return result.messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => message.line)
}

describe('the error text lint rule', () => {
  test.each([
    [
      'an errorMessage text',
      "export const a = { errorMessage: { text: 'Enter a name' } }"
    ],
    [
      'an errorMessage text as a template',
      `export const a = (n) => ({ errorMessage: { text: \`Enter \${n}\` } })`
    ],
    [
      'a Joi .messages() value',
      "export const b = (s) => s.messages({ 'string.max': 'Too long' })"
    ],
    [
      'a Joi .messages() value as a template',
      `export const b = (s, n) => s.messages({ 'string.max': \`Under \${n}\` })`
    ],
    [
      "helpers.error's message",
      "export const c = (helpers) => helpers.error('x', { message: 'Too long' })"
    ],
    [
      'an assignment to errors.<field>',
      "export function d(errors) { errors.ref = 'Enter a reference' }"
    ],
    [
      'an assignment to errors.<field> as a template',
      `export function d(errors, n) { errors.ref = \`Enter \${n}\` }`
    ],
    [
      'words put in an upload error session key',
      "export function e(request, t) { request.yar.set(t.uploadErrorSessionKey, 'Try again') }"
    ]
  ])('refuses %s', async (_, code) => {
    expect(await restrictedLines(code)).toEqual([1])
  })

  test.each([
    [
      "a Joi .messages() that passes '{{#message}}' through",
      "export const b = (s) => s.messages({ 'x.invalid': '{{#message}}' })"
    ],
    [
      'a Joi .messages() from joiMessages',
      "export const b = (s, joiMessages) => s.messages(joiMessages('projectName', { 'any.required': 'required' }))"
    ],
    [
      'an errorMessage text from a variable',
      'export const a = (text) => ({ errorMessage: { text } })'
    ],
    [
      'an errorMessage with no text',
      "export const a = { errorMessage: { text: '' } }"
    ],
    [
      'an assignment from error-text.yaml',
      'export function d(errors, ERRORS) { errors.ref = ERRORS.refInvalid }'
    ],
    [
      'a rule put in an upload error session key',
      'export function e(request, t, words) { request.yar.set(t.uploadErrorSessionKey, words) }'
    ],
    [
      'words that are not error text',
      "export const f = { text: 'Home', href: '/' }"
    ]
  ])('allows %s', async (_, code) => {
    expect(await restrictedLines(code)).toEqual([])
  })

  test('does not apply to tests', async () => {
    const [result] = await eslint.lintText(
      "export const a = { errorMessage: { text: 'Enter a name' } }",
      { filePath: path.join(ROOT, 'src/server/eslint-guard-sample.test.js') }
    )
    expect(result.messages.filter((m) => m.ruleId === RULE)).toEqual([])
  })
})

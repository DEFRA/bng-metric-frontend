import neostandard from 'neostandard'

// Words a customer sees when something is refused or goes wrong live in
// src/server/common/error-text/error-text.yaml, for UCD to review in one
// place. These catch the usual ways of writing one into the code instead.
const WORDING = ':matches(Literal[value=/\\w/], TemplateLiteral)'
const ERROR_TEXT_MESSAGE =
  'Customer-facing error text belongs in error-text.yaml: read it with formErrorText, joiMessages or pageErrorText.'
const errorTextRestrictions = [
  // errorMessage: { text: 'Enter a name' }
  `Property[key.name='errorMessage'] > ObjectExpression > Property[key.name='text'] > ${WORDING}`,
  // Joi's .messages({ 'string.max': 'Too long' }). '{{#message}}' passes a
  // message made elsewhere through, so is no wording of its own.
  `CallExpression[callee.property.name='messages'] > ObjectExpression > Property > :matches(Literal[value=/^(?!\\{\\{#)\\w/], TemplateLiteral).value`,
  // helpers.error('custom.code', { message: 'Too long' })
  `CallExpression[callee.object.name='helpers'][callee.property.name='error'] Property[key.name='message'] > ${WORDING}`,
  // errors.ref = 'Enter a reference'
  `AssignmentExpression[left.object.name='errors'] > ${WORDING}.right`,
  // request.yar.set(uploadType.uploadErrorSessionKey, 'Try again')
  `CallExpression[callee.property.name='set'][arguments.0.property.name=/ErrorSessionKey$/] > ${WORDING}.arguments`
].map((selector) => ({ selector, message: ERROR_TEXT_MESSAGE }))

export default [
  { ignores: ['.cache/**', 'coverage/**', '.public/**'] },
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore(), '.public/**'],
    noJsx: true,
    noStyle: true
  }),
  {
    files: ['src/**/*.js'],
    ignores: ['**/*.test.js', 'src/**/test-helpers/**'],
    rules: { 'no-restricted-syntax': ['error', ...errorTextRestrictions] }
  }
]

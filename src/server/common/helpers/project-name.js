import Joi from 'joi'

import { formErrorText } from '../error-text/error-text.js'

const MAX_PROJECT_NAME_LENGTH = 1000

// A project name's messages show the same words in the error summary and
// against the field, so only the inline text is needed.
const message = (rule, values) =>
  formErrorText('projectName', rule, values).inline
const REQUIRED = message('required')

export const projectNameSchema = Joi.string()
  .trim()
  .empty('')
  .required()
  .max(MAX_PROJECT_NAME_LENGTH)
  .custom((value, helpers) => {
    const hasInvalidChars = [...value].some((char) => {
      const codePoint = char.codePointAt(0)
      return (
        codePoint < 0x20 ||
        codePoint === 0x7f ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      )
    })
    return hasInvalidChars ? helpers.error('string.invalidChars') : value
  })
  .messages({
    'string.base': REQUIRED,
    'string.empty': REQUIRED,
    'any.required': REQUIRED,
    'string.max': message('tooLong', { max: MAX_PROJECT_NAME_LENGTH }),
    'string.invalidChars': message('invalidCharacters')
  })

export function validateProjectName(projectName) {
  const { error } = projectNameSchema.validate(projectName)
  if (!error) return []
  return [{ text: error.details[0].message, href: '#project-name' }]
}

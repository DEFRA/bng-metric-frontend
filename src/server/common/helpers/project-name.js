import Joi from 'joi'

import { joiErrorText, joiMessages } from '../error-text/joi-error-text.js'

const MAX_PROJECT_NAME_LENGTH = 1000

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
  .messages(
    joiMessages('projectName', {
      'string.base': 'required',
      'string.empty': 'required',
      'any.required': 'required',
      'string.max': ['tooLong', { max: MAX_PROJECT_NAME_LENGTH }],
      'string.invalidChars': 'invalidCharacters'
    })
  )

export function validateProjectName(projectName) {
  const { error } = projectNameSchema.validate(projectName)
  if (!error) return []
  return [{ text: joiErrorText(error.details[0]), href: '#project-name' }]
}

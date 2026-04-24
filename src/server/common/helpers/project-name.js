import Joi from 'joi'

const projectNameSchema = Joi.string()
  .trim()
  .empty('')
  .required()
  .max(1000)
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
    'string.base': 'Enter a project name',
    'string.empty': 'Enter a project name',
    'any.required': 'Enter a project name',
    'string.max': 'Project name must be 1000 characters or fewer',
    'string.invalidChars': 'Project name must only contain valid characters'
  })

export function validateProjectName(projectName) {
  const { error } = projectNameSchema.validate(projectName)
  if (!error) return []
  return [{ text: error.details[0].message, href: '#project-name' }]
}

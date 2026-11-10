import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  ERROR_TEXT_FILE,
  PLACEHOLDER,
  editErrorText,
  errorText,
  fillErrorText,
  formErrorText,
  parseErrorText
} from './error-text.js'

const SOURCE = readFileSync(ERROR_TEXT_FILE, 'utf8')

describe('error-text.yaml', () => {
  test('holds the upload, edit and forms sections', () => {
    expect(Object.keys(errorText)).toEqual(['upload', 'edit', 'forms'])
  })

  test("words the upload page's busy message as the drop-out page's", () => {
    expect(errorText.forms.file.serviceBusy).toBe(
      errorText.upload.errors.VALIDATION_BUSY.inList.heading
    )
  })

  test('words every edit refusal with a summary and an inline message, or marks it a placeholder', () => {
    for (const [code, entry] of Object.entries(errorText.edit)) {
      if (entry === PLACEHOLDER) {
        continue
      }
      expect(entry.summary, code).toMatch(/\S/)
      expect(entry.inline, code).toMatch(/\S/)
    }
  })
})

describe('parseErrorText', () => {
  test('reads the committed file', () => {
    expect(parseErrorText(SOURCE).edit.HABITAT_REF_IN_USE).toBeDefined()
  })

  test('refuses a file with no edit section', () => {
    const { upload, forms } = parseErrorText(SOURCE)
    expect(() => parseErrorText(JSON.stringify({ upload, forms }))).toThrow(
      /not valid.*edit.*required/
    )
  })

  test('refuses an edit entry with no inline message', () => {
    const text = parseErrorText(SOURCE)
    delete text.edit.HABITAT_REF_IN_USE.inline
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /HABITAT_REF_IN_USE.*inline/
    )
  })

  test('refuses a form message that is blank', () => {
    const text = parseErrorText(SOURCE)
    text.forms.projectName.required = ' '
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /projectName\.required/
    )
  })

  test('refuses an edit entry that is neither wording nor a placeholder', () => {
    const text = parseErrorText(SOURCE)
    text.edit.ENHANCEMENT_NOT_VALID = 'placholder'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(/not valid/)
  })
})

describe('editErrorText', () => {
  test('gives the wording for an edit code that has some', () => {
    expect(editErrorText('HABITAT_REF_IN_USE')).toEqual({
      summary: 'You have entered a habitat reference that is already in use.',
      inline: 'Enter a habitat reference that is not already in use.'
    })
  })

  test.each([['ENHANCEMENT_NOT_VALID'], ['NOT_A_CODE'], [undefined]])(
    'gives null for %s, which has no wording yet',
    (errorCode) => {
      expect(editErrorText(errorCode)).toBeNull()
    }
  )
})

describe('fillErrorText', () => {
  test('fills each {name} from the values', () => {
    expect(
      fillErrorText('{what} must be {max} or fewer', { what: 'It', max: 3 })
    ).toBe('It must be 3 or fewer')
  })

  test('throws for a {name} with no value', () => {
    expect(() => fillErrorText('Must be {max} or fewer', {})).toThrow(
      /no value for \{max\}/
    )
  })
})

describe('formErrorText', () => {
  test("gives a field's wording for a rule", () => {
    expect(formErrorText('habitatRef', 'invalid')).toEqual({
      summary: 'You have entered an invalid habitat reference.',
      inline: 'Enter a valid habitat reference.'
    })
  })

  test('gives a rule worded in one line as both the summary and inline message', () => {
    expect(formErrorText('projectName', 'required')).toEqual({
      summary: 'Enter a project name',
      inline: 'Enter a project name'
    })
  })

  test('fills in the values a rule names', () => {
    expect(formErrorText('projectName', 'tooLong', { max: 1000 })).toEqual({
      summary: 'Project name must be 1000 characters or fewer',
      inline: 'Project name must be 1000 characters or fewer'
    })
  })

  test('throws for a rule whose values are not given', () => {
    expect(() => formErrorText('projectName', 'tooLong')).toThrow(
      /no value for \{max\}/
    )
  })

  test('throws for a rule the file does not word', () => {
    expect(() => formErrorText('habitatRef', 'notARule')).toThrow(
      /no forms\.habitatRef\.notARule/
    )
  })
})

import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  ERROR_TEXT_FILE,
  PLACEHOLDER,
  editErrorText,
  errorText,
  formErrorText,
  parseErrorText
} from './error-text.js'

const SOURCE = readFileSync(ERROR_TEXT_FILE, 'utf8')

describe('error-text.yaml', () => {
  test('holds the upload, edit and forms sections', () => {
    expect(Object.keys(errorText)).toEqual(['upload', 'edit', 'forms'])
  })

  test('words every edit refusal with a summary and an inline message, or a summary-only message, or marks it a placeholder', () => {
    for (const [code, entry] of Object.entries(errorText.edit)) {
      if (entry === PLACEHOLDER) {
        continue
      }
      if (Object.hasOwn(entry, 'summaryOnly')) {
        expect(entry.summaryOnly, code).toMatch(/\S/)
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

  test('refuses a summary-only edit entry that also has field wording', () => {
    const text = parseErrorText(SOURCE)
    text.edit.STORED_VALUE_NOT_ALLOWED.inline = 'Inline.'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /STORED_VALUE_NOT_ALLOWED.*inline.*not allowed/
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

  test('gives the summary-only wording for an edit code no one field can put right', () => {
    expect(editErrorText('STORED_VALUE_NOT_ALLOWED')).toEqual({
      summaryOnly: expect.stringContaining('{fields}')
    })
  })

  test.each([['ENHANCEMENT_NOT_VALID'], ['NOT_A_CODE'], [undefined]])(
    'gives null for %s, which has no wording yet',
    (errorCode) => {
      expect(editErrorText(errorCode)).toBeNull()
    }
  )
})

describe('formErrorText', () => {
  test("gives a field's wording for a rule", () => {
    expect(formErrorText('habitatRef', 'invalid')).toEqual({
      summary: 'You have entered an invalid habitat reference.',
      inline: 'Enter a valid habitat reference.'
    })
  })

  test('throws for a rule the file does not word', () => {
    expect(() => formErrorText('habitatRef', 'notARule')).toThrow(
      /no forms\.habitatRef\.notARule/
    )
  })
})

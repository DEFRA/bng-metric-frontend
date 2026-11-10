import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  ERROR_TEXT_FILE,
  commonErrorText,
  pageErrorText,
  editErrorText,
  errorText,
  fillErrorText,
  formErrorText,
  parseErrorText
} from './error-text.js'

import { WORDING_STATUS, wordingStatus } from './wording.js'

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))
vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn })
}))

const SOURCE = readFileSync(ERROR_TEXT_FILE, 'utf8')

describe('error-text.yaml', () => {
  test('holds the common, upload, edit, forms and pages sections', () => {
    expect(Object.keys(errorText)).toEqual([
      'common',
      'upload',
      'edit',
      'forms',
      'pages'
    ])
  })

  test("words the upload page's busy message as the drop-out page's", () => {
    expect(errorText.forms.file.serviceBusy).toBe(
      errorText.upload.errors.VALIDATION_BUSY.inList.heading
    )
  })

  test('words every edit refusal with a summary and an inline message, or says it has no wording yet', () => {
    for (const [code, entry] of Object.entries(errorText.edit)) {
      if (wordingStatus(entry) === WORDING_STATUS.NONE) {
        continue
      }
      expect(entry.summary, code).toMatch(/\S/)
      expect(entry.inline, code).toMatch(/\S/)
    }
  })

  test('marks unfinished wording only with a wording field', () => {
    expect(SOURCE).not.toMatch(/AWAITING UCD/)
    expect(SOURCE).not.toMatch(/:\s*placeholder\s*$/m)
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

  test('refuses HTML in a page', () => {
    const text = parseErrorText(SOURCE)
    text.pages.accessDenied.body[1] = 'An <strong>approved</strong> role'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(/no HTML/)
  })

  test('refuses a page link to somewhere it does not know', () => {
    const text = parseErrorText(SOURCE)
    text.pages.accessDenied.body[2] = '[Return](upload)'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /links to "upload"/
    )
  })

  test('refuses a page with neither a title nor a body', () => {
    const text = parseErrorText(SOURCE)
    text.pages.notFound = {}
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(/notFound/)
  })

  test('refuses an edit entry given as a word, as "placeholder" once was', () => {
    const text = parseErrorText(SOURCE)
    text.edit.ENHANCEMENT_NOT_VALID = 'placeholder'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /ENHANCEMENT_NOT_VALID/
    )
  })
})

describe("error-text.yaml's wording field", () => {
  beforeEach(() => {
    mockWarn.mockClear()
  })

  test('reads it in every section', () => {
    const text = parseErrorText(SOURCE)
    expect(wordingStatus(text.common.unworded)).toBe(WORDING_STATUS.INTERIM)
    expect(wordingStatus(text.edit.HABITAT_REF_IN_USE)).toBe(
      WORDING_STATUS.INTERIM
    )
    expect(wordingStatus(text.edit.ENHANCEMENT_NOT_VALID)).toBe(
      WORDING_STATUS.NONE
    )
    expect(wordingStatus(text.forms.applicant.tooLong)).toBe(
      WORDING_STATUS.INTERIM
    )
    expect(wordingStatus(text.forms.projectName.required)).toBe(
      WORDING_STATUS.FINAL
    )
    expect(wordingStatus(text.pages.forbidden)).toBe(WORDING_STATUS.INTERIM)
    expect(wordingStatus(text.pages.notFound)).toBe(WORDING_STATUS.FINAL)
  })

  test('gives no warning for the committed file', () => {
    parseErrorText(SOURCE)
    expect(mockWarn).not.toHaveBeenCalled()
  })

  test('warns of a value it does not know, rather than refusing the file', () => {
    const text = parseErrorText(SOURCE)
    text.pages.forbidden.wording = 'interm'
    const parsed = parseErrorText(JSON.stringify(text))
    expect(wordingStatus(parsed.pages.forbidden)).toBe(WORDING_STATUS.NONE)
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^error-text\.yaml: pages\.forbidden\.wording is "interm"/
      )
    )
  })

  test('refuses interim wording with no words', () => {
    const text = parseErrorText(SOURCE)
    text.edit.HABITAT_REF_IN_USE = { wording: 'interim' }
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /HABITAT_REF_IN_USE\.summary.*required/
    )
  })

  test('refuses a form rule with interim wording and no words', () => {
    const text = parseErrorText(SOURCE)
    text.forms.applicant.tooLong = { wording: 'interim' }
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /applicant\.tooLong/
    )
  })

  test('refuses a form rule with both one text and a pair', () => {
    const text = parseErrorText(SOURCE)
    text.forms.applicant.tooLong.summary = 'One'
    text.forms.applicant.tooLong.inline = 'Two'
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /applicant\.tooLong/
    )
  })

  test('refuses common text with no words, which other entries fall back to', () => {
    const text = parseErrorText(SOURCE)
    text.common.unworded = { wording: 'none' }
    expect(() => parseErrorText(JSON.stringify(text))).toThrow(
      /unworded\.text.*required/
    )
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

  test('gives a rule worded as text beside its wording field as both messages', () => {
    expect(formErrorText('applicant', 'tooLong', { max: 5 })).toEqual({
      summary: 'Applicant must be 5 characters or fewer',
      inline: 'Applicant must be 5 characters or fewer'
    })
  })

  test('gives common.unworded for a rule with no wording yet', () => {
    errorText.forms.applicant.unwritten = { wording: 'none' }
    try {
      expect(formErrorText('applicant', 'unwritten')).toEqual({
        summary: 'There is a problem with this answer',
        inline: 'There is a problem with this answer'
      })
    } finally {
      delete errorText.forms.applicant.unwritten
    }
  })

  test('throws for a rule the file does not word', () => {
    expect(() => formErrorText('habitatRef', 'notARule')).toThrow(
      /no forms\.habitatRef\.notARule/
    )
  })
})

describe('commonErrorText', () => {
  test("gives the error summary's title", () => {
    expect(commonErrorText('summaryTitle')).toBe('There is a problem')
  })

  test('gives the words of text with a wording field', () => {
    expect(commonErrorText('unworded')).toBe(
      'There is a problem with this answer'
    )
  })
})

describe('pageErrorText', () => {
  test("gives a page's title and its body, a line at a time, with its link", () => {
    expect(pageErrorText('accessDenied')).toEqual({
      title: 'Access denied',
      body: [
        { before: 'You do not have permission to view this page.' },
        { before: expect.stringContaining('approved BNG completer role') },
        {
          before: '',
          link: { text: 'Return to the home page', href: '/' },
          after: ''
        }
      ]
    })
  })

  test('gives a page with only a title an empty body', () => {
    expect(pageErrorText('notFound')).toEqual({
      title: 'Page not found',
      body: []
    })
  })

  test('throws for a page the file does not word', () => {
    expect(() => pageErrorText('notAPage')).toThrow(/no pages\.notAPage/)
  })
})

// @vitest-environment happy-dom
import { initCreatedAreaDetails } from './created-area-details.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaValues,
  validateCreatedArea
} from '../../server/post-intervention-habitat-details/created-area-edit.js'
import {
  createdHedgerowFeature as feature,
  hedgerowCreationReference as reference
} from '../../server/post-intervention-habitat-details/created-hedgerow-test-fixtures.js'
import { renderTemplateIntoDocument } from '../../server/test-helpers/render-template.js'
import { runAxeChecks } from '../../server/test-helpers/axe-helper.js'
const ctx = {
  projectId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  projectName: 'Test project'
}
beforeAll(() => {
  window.happyDOM.settings.enableJavaScriptEvaluation = false
  window.happyDOM.settings.disableCSSFileLoading = true
  window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
})
const text = (id) => document.getElementById(id).textContent
const value = (id) => document.getElementById(id).value
function change(id, value) {
  const element = document.getElementById(id)
  element.value = value
  element.dispatchEvent(new Event('change'))
}
function render(values = null, errors = {}) {
  renderTemplateIntoDocument(
    'habitat-details/pi-habitat-details-created-edit.njk',
    {
      ...buildCreatedAreaEditViewModel(feature, reference, ctx, values, errors),
      crumb: 'test-token'
    }
  )
  initCreatedAreaDetails()
}
beforeEach(() => render())
test('renders saved inputs, fixed length, null plus 0..30 and 30+, and navigation', () => {
  expect(document.getElementById('broadHabitat')).toBeNull()
  expect(value('ref')).toBe('H-1')
  expect(value('habitatType')).toBe('Native hedgerow')
  expect(value('condition')).toBe('Good')
  expect(value('advanceYears')).toBe('0')
  expect(text('sizeDisplay')).toBe('0.336km')
  expect(document.querySelectorAll('#delayYears option')).toHaveLength(33)
  expect(document.querySelector('input[name=crumb]').value).toBe('test-token')
  expect(
    document.querySelector('a.govuk-button').getAttribute('href')
  ).toContain('/upload-file?')
  expect(
    [...document.querySelectorAll('a')]
      .find((a) => a.textContent === 'Cancel')
      .getAttribute('href')
  ).toBe(`/projects/${ctx.projectId}/hedgerows-post-intervention`)
})
test('type changes reset only target condition and update hedgerow derived fields', () => {
  change('habitatType', 'Native hedgerow with trees')
  expect(value('condition')).toBe('')
  expect(document.querySelectorAll('#condition option')).toHaveLength(2)
  expect(value('strategicSignificance')).toBe('Low')
  expect(value('advanceYears')).toBe('0')
  expect(text('distinctivenessDisplay')).toBe('Medium (4)')
  expect(text('standardTimeToTargetDisplay')).toBe('')
  expect(text('finalTimeToTargetDisplay')).toBe('')
  change('condition', 'Good')
  expect(text('standardTimeToTargetDisplay')).toBe('Good - 10 years')
  expect(text('finalTimeToTargetDisplay')).toBe('10 years (0.7)')
  change('habitatType', '')
  expect(document.querySelectorAll('#condition option')).toHaveLength(1)
  for (const id of [
    'distinctivenessDisplay',
    'standardDifficultyDisplay',
    'appliedDifficultyMultiplierDisplay',
    'standardTimeToTargetDisplay',
    'finalTimeToTargetDisplay'
  ]) {
    expect(text(id)).toBe('')
    expect(document.getElementById(id)).not.toBeNull()
  }
})
test('condition and timing previews preserve other inputs and stored units', () => {
  const units = document.querySelector('.app-pi-edit-units').textContent
  change('advanceYears', '2')
  expect(text('finalTimeToTargetDisplay')).toBe('5 years (0.8368287006)')
  change('delayYears', '3')
  expect(value('advanceYears')).toBe('2')
  expect(text('finalTimeToTargetDisplay')).toBe('')
  change('advanceYears', '0')
  expect(text('finalTimeToTargetDisplay')).toBe('10 years (0.7)')
  change('delayYears', '30+')
  expect(text('finalTimeToTargetDisplay')).toBe('30+ years (0.3197967361)')
  change('delayYears', '')
  expect(text('finalTimeToTargetDisplay')).toBe('')
  change('condition', '')
  expect(text('standardTimeToTargetDisplay')).toBe('')
  expect(text('standardDifficultyDisplay')).toBe('Low')
  expect(document.querySelector('.app-pi-edit-units').textContent).toBe(units)
})
test('reference and significance edits leave calculations and other inputs unchanged', () => {
  const previous = text('finalTimeToTargetDisplay')
  change('ref', 'Different')
  change('strategicSignificance', '')
  expect(value('condition')).toBe('Good')
  expect(text('finalTimeToTargetDisplay')).toBe(previous)
})
test('incomplete values render default choices and retain blank derived rows', () => {
  render({
    ...createdAreaValues(feature),
    habitatType: '',
    condition: '',
    strategicSignificance: '',
    advanceYears: '',
    delayYears: ''
  })
  for (const id of [
    'habitatType',
    'condition',
    'strategicSignificance',
    'advanceYears',
    'delayYears'
  ]) {
    expect(value(id)).toBe('')
    expect(
      document.getElementById(id).selectedOptions[0].textContent
    ).toContain('Choose ')
  }
  expect(text('finalTimeToTargetDisplay')).toBe('')
  expect(document.querySelector('button[type=submit]').textContent).toContain(
    'Save'
  )
})
test.each([false, true])(
  'passes axe with validation errors %s',
  async (invalid) => {
    if (invalid) {
      const values = {
        ...createdAreaValues(feature),
        ref: '',
        advanceYears: '1',
        delayYears: '1'
      }
      render(values, validateCreatedArea(values, reference))
      expect(
        document.querySelectorAll('.govuk-error-summary__list li')
      ).toHaveLength(2)
      expect(
        document.getElementById('delayYears').getAttribute('aria-describedby')
      ).toContain('timing-error')
    }
    await runAxeChecks(document.documentElement)
  }
)

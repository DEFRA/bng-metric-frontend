// @vitest-environment happy-dom
import { initCreatedAreaDetails } from './created-area-details.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaValues,
  validateCreatedArea
} from '../../server/post-intervention-habitat-details/created-area-edit.js'
import {
  createdWatercourseFeature as feature,
  watercourseCreationReference as reference
} from '../../server/post-intervention-habitat-details/created-watercourse-test-fixtures.js'
import { renderTemplateIntoDocument } from '../../server/test-helpers/render-template.js'
import { runAxeChecks } from '../../server/test-helpers/axe-helper.js'

const ctx = {
  projectId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  projectName: 'Watercourse project'
}
const value = (id) => document.getElementById(id).value
const text = (id) => document.getElementById(id).textContent
function change(id, selected) {
  const element = document.getElementById(id)
  element.value = selected
  element.dispatchEvent(new Event('change'))
}
function render(stored = feature, values = null, errors = {}) {
  renderTemplateIntoDocument(
    'habitat-details/pi-habitat-details-created-edit.njk',
    {
      ...buildCreatedAreaEditViewModel(stored, reference, ctx, values, errors),
      crumb: 'test-token'
    }
  )
  initCreatedAreaDetails()
}
beforeAll(() => {
  window.happyDOM.settings.enableJavaScriptEvaluation = false
  window.happyDOM.settings.disableCSSFileLoading = true
  window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
})
beforeEach(() => render())

test('keeps an imported condition available when the stored type is blank', () => {
  render({
    ...feature,
    proposed: { ...feature.proposed, type: null, condition: 'Good' }
  })
  expect(value('habitatType')).toBe('')
  expect(value('condition')).toBe('unchanged')
  change('ref', 'Renamed')
  expect(
    new FormData(document.getElementById('created-area-details-form')).get(
      'condition'
    )
  ).toBe('unchanged')
  change('habitatType', 'Canals')
  expect(value('condition')).toBe('')
  expect(
    document.querySelector('#condition option[value="unchanged"]')
  ).toBeNull()
  change('habitatType', '')
  expect(
    document.querySelector('#condition option[value="unchanged"]').textContent
  ).toBe('Good (imported value)')
  change('condition', 'unchanged')
  const values = Object.fromEntries(
    new FormData(document.getElementById('created-area-details-form'))
  )
  const savedReference = JSON.parse(
    document.getElementById('created-area-reference-data').textContent
  )
  expect(validateCreatedArea(values, savedReference)).toEqual({})
  change('condition', '')
  expect(value('condition')).toBe('')
})

test('renders fixed size and all watercourse-only controls with their own defaults', async () => {
  expect(document.getElementById('broadHabitat')).toBeNull()
  expect(text('sizeDisplay')).toBe('0.5km')
  expect(value('watercourseEncroachment')).toBe('Minor')
  expect(value('riparianEncroachment')).toBe('Minor/No Encroachment')
  expect(
    document.querySelector('#watercourseEncroachment option').textContent
  ).toBe('Choose watercourse encroachment')
  expect(
    document.querySelector('#riparianEncroachment option').textContent
  ).toBe('Choose riparian encroachment')
  expect(document.querySelectorAll('#advanceYears option')).toHaveLength(33)
  expect(document.querySelectorAll('#delayYears option')).toHaveLength(33)
  expect(document.querySelectorAll('#habitatType option')).toHaveLength(4)
  await runAxeChecks(document.documentElement)
})

test.each(['watercourseEncroachment', 'riparianEncroachment'])(
  'changing or clearing %s leaves every other field and derived display unchanged',
  (field) => {
    const before = Object.fromEntries(
      new FormData(document.getElementById('created-area-details-form'))
    )
    const time = text('finalTimeToTargetDisplay')
    const units = document.querySelector('.app-units-delivered').textContent
    change(field, '')
    const after = Object.fromEntries(
      new FormData(document.getElementById('created-area-details-form'))
    )
    expect(after).toEqual({ ...before, [field]: '' })
    expect(text('finalTimeToTargetDisplay')).toBe(time)
    expect(document.querySelector('.app-units-delivered').textContent).toBe(
      units
    )
    change(field, reference[field][0])
    expect(value(field)).toBe(reference[field][0])
  }
)

test('type changes reset condition alone and exclude impossible creation choices', () => {
  change('habitatType', 'Culvert')
  expect(value('condition')).toBe('')
  expect(
    [...document.querySelectorAll('#condition option')].map((o) => o.value)
  ).toEqual(['', 'Poor'])
  expect(value('watercourseEncroachment')).toBe('Minor')
  expect(value('riparianEncroachment')).toBe('Minor/No Encroachment')
  expect(value('strategicSignificance')).toBe('Low')
  expect(value('advanceYears')).toBe('0')
  expect(text('distinctivenessDisplay')).toBe('Low (2)')
  expect(text('standardDifficultyDisplay')).toBe('Medium')
  expect(text('standardTimeToTargetDisplay')).toBe('')
  change('condition', 'Poor')
  expect(text('standardTimeToTargetDisplay')).toBe('Moderate to Poor - 1 years')
  expect(text('finalTimeToTargetDisplay')).toBe('1 years (0.965)')
  change('habitatType', '')
  expect(document.querySelectorAll('#condition option')).toHaveLength(1)
  expect(text('distinctivenessDisplay')).toBe('')
  expect(text('standardDifficultyDisplay')).toBe('')
  expect(text('appliedDifficultyMultiplierDisplay')).toBe('')
})

test('timing previews include zero and 30+, blank for missing or conflicting values, and retain stored units', () => {
  const units = document.querySelector('.app-units-delivered').textContent
  change('advanceYears', '30+')
  expect(text('finalTimeToTargetDisplay')).toBe('0 years (1)')
  change('delayYears', '1')
  expect(text('finalTimeToTargetDisplay')).toBe('')
  change('advanceYears', '0')
  expect(text('finalTimeToTargetDisplay')).toBe('6 years (0.8075396961)')
  change('advanceYears', '')
  expect(text('finalTimeToTargetDisplay')).toBe('')
  expect(document.querySelector('.app-units-delivered').textContent).toBe(units)
})

test('an incomplete feature selects blank defaults and leaves all derived labels present', async () => {
  render({ ...feature, units: null, proposed: {} })
  for (const id of [
    'habitatType',
    'condition',
    'strategicSignificance',
    'advanceYears',
    'delayYears',
    'watercourseEncroachment',
    'riparianEncroachment'
  ]) {
    expect(value(id)).toBe('')
  }
  for (const id of [
    'distinctivenessDisplay',
    'standardDifficultyDisplay',
    'standardTimeToTargetDisplay',
    'finalTimeToTargetDisplay',
    'appliedDifficultyMultiplierDisplay'
  ]) {
    expect(text(id)).toBe('')
  }
  expect(document.querySelector('button[type=submit]').textContent.trim()).toBe(
    'Save'
  )
  await runAxeChecks(document.documentElement)
})

test('restores a saved timing label only for its original advance when previews calculate the same result', () => {
  const savedLabel = 'Saved imported final time label'
  render({
    ...feature,
    proposed: {
      ...feature.proposed,
      advanceYears: 10,
      finalTimeToTargetCondition: savedLabel
    }
  })
  expect(value('advanceYears')).toBe('10')
  expect(text('finalTimeToTargetDisplay')).toBe(savedLabel)
  change('advanceYears', '30+')
  expect(text('finalTimeToTargetDisplay')).toBe('0 years (1)')
  change('advanceYears', '20')
  expect(text('finalTimeToTargetDisplay')).toBe('0 years (1)')
  change('advanceYears', '10')
  expect(text('finalTimeToTargetDisplay')).toBe(savedLabel)
})

test('retains unavailable imported encroachment independently when the habitat type changes', () => {
  render({
    ...feature,
    proposed: { ...feature.proposed, riparianEncroachment: 'Imported value' }
  })
  expect(value('riparianEncroachment')).toBe('unchanged')
  expect(text('riparianEncroachment-hint')).toContain('Keep it unchanged')
  change('habitatType', 'Canals')
  expect(value('riparianEncroachment')).toBe('unchanged')
  expect(value('watercourseEncroachment')).toBe('Minor')
})

test('validation errors preserve both encroachments and give accessible summary and field links', async () => {
  const values = {
    ...createdAreaValues(feature),
    ref: '',
    advanceYears: '2',
    delayYears: '1',
    riparianEncroachment: ''
  }
  const errors = validateCreatedArea(values, reference)
  render(feature, values, errors)
  expect(value('watercourseEncroachment')).toBe('Minor')
  expect(value('riparianEncroachment')).toBe('')
  expect(
    [...document.querySelectorAll('.govuk-error-summary__list a')].map((a) =>
      a.getAttribute('href')
    )
  ).toEqual(['#ref', '#advanceYears'])
  for (const id of ['advanceYears', 'delayYears']) {
    expect(
      document.getElementById(id).getAttribute('aria-describedby')
    ).toContain('timing-error')
  }
  await runAxeChecks(document.documentElement)
})

test('a type change refreshes legacy saved difficulty even when both reference types share the same difficulty', () => {
  render({
    ...feature,
    proposed: {
      ...feature.proposed,
      difficulty: 'Low',
      difficultyMultiplier: 1
    }
  })
  expect(text('standardDifficultyDisplay')).toBe('Low')
  expect(text('appliedDifficultyMultiplierDisplay')).toBe('1')
  change('habitatType', 'Canals')
  expect(text('standardDifficultyDisplay')).toBe('Medium')
  expect(text('appliedDifficultyMultiplierDisplay')).toBe('0.67')
  change('habitatType', 'Ditches')
  expect(text('standardDifficultyDisplay')).toBe('Low')
  expect(text('appliedDifficultyMultiplierDisplay')).toBe('1')
})

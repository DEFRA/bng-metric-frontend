// @vitest-environment happy-dom
import { initCreatedAreaDetails } from './created-area-details.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaValues,
  validateCreatedArea
} from '../../server/post-intervention-habitat-details/created-area-edit.js'
import {
  createdAreaFeature,
  creationReference
} from '../../server/post-intervention-habitat-details/created-area-test-fixtures.js'
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
const value = (id) => document.getElementById(id).value
const text = (id) => document.getElementById(id).textContent
function change(id, selected) {
  document.getElementById(id).value = selected
  document.getElementById(id).dispatchEvent(new Event('change'))
}
function render(values = createdAreaValues(createdAreaFeature), errors = {}) {
  renderTemplateIntoDocument(
    'habitat-details/pi-habitat-details-created-edit.njk',
    {
      ...buildCreatedAreaEditViewModel(
        createdAreaFeature,
        creationReference,
        ctx,
        values,
        errors
      ),
      crumb: 'test-token'
    }
  )
  initCreatedAreaDetails()
}

describe('Created area editing', () => {
  beforeEach(() => render())

  test('prepopulates saved fields and zero timing; keeps units unchanged', () => {
    expect(value('ref')).toBe('P-1')
    expect(value('condition')).toBe('Good')
    expect(value('advanceYears')).toBe('0')
    expect(value('delayYears')).toBe('0')
    expect(document.querySelectorAll('#advanceYears option')).toHaveLength(33)
    expect(document.querySelector('input[name=crumb]').value).toBe('test-token')
    expect(document.body.textContent).toContain('11.68')
    expect(document.querySelector('a.govuk-button').href).toContain(
      '/upload-file?'
    )
  })

  test('announces changed calculation labels politely without moving focus', () => {
    const status = document.getElementById('created-area-results-status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('')
    document.getElementById('advanceYears').focus()
    change('advanceYears', '2')
    expect(status.textContent).toContain(
      'Final time to target condition (multiplier): 5 years'
    )
    expect(document.activeElement.id).toBe('advanceYears')
    change('condition', '')
    expect(status.textContent).toContain(
      'Final time to target condition (multiplier): Not available'
    )
  })

  test('preserves stored calculation formatting and announces only changed calculations', () => {
    const imported = {
      ...createdAreaFeature,
      baseline: { condition: 'Poor' },
      proposed: {
        ...createdAreaFeature.proposed,
        standardTimeToTargetCondition: '7',
        finalTimeToTargetCondition: 'Saved final time label',
        difficultyMultiplier: 0.5
      }
    }
    renderTemplateIntoDocument(
      'habitat-details/pi-habitat-details-created-edit.njk',
      {
        ...buildCreatedAreaEditViewModel(imported, creationReference, ctx),
        crumb: 'test-token'
      }
    )
    const initialStandard = text('standardTimeToTargetDisplay')
    const initialFinal = text('finalTimeToTargetDisplay')
    const initialDifficulty = text('appliedDifficultyMultiplierDisplay')
    expect(initialStandard).toContain('Poor')
    expect(initialFinal).toBe('Saved final time label')
    initCreatedAreaDetails()
    change('delayYears', '0')
    expect(text('standardTimeToTargetDisplay')).toBe(initialStandard)
    expect(text('finalTimeToTargetDisplay')).toBe(initialFinal)
    expect(text('appliedDifficultyMultiplierDisplay')).toBe(initialDifficulty)
    expect(text('created-area-results-status')).toBe('')

    change('delayYears', '2')
    expect(text('standardTimeToTargetDisplay')).toBe(initialStandard)
    expect(text('created-area-results-status')).toContain(
      'Final time to target condition'
    )
    expect(text('created-area-results-status')).not.toContain(
      'Standard time to target condition:'
    )
    change('condition', 'Poor')
    expect(text('standardTimeToTargetDisplay')).toBe('Poor to Poor - 1 years')
    expect(text('created-area-results-status')).toContain(
      'Standard time to target condition: Poor'
    )
    change('condition', 'Good')
    expect(text('standardTimeToTargetDisplay')).toBe(initialStandard)
    change('delayYears', '0')
    expect(text('finalTimeToTargetDisplay')).toBe(initialFinal)
  })

  test('renders the matching baseline link and preserves the list anchor in the form', () => {
    const returnUrl = `/projects/${ctx.projectId}/area-post-intervention#created`
    renderTemplateIntoDocument(
      'habitat-details/pi-habitat-details-created-edit.njk',
      {
        ...buildCreatedAreaEditViewModel(
          createdAreaFeature,
          creationReference,
          { ...ctx, baselineFeatureId: 'baseline-1', returnUrl }
        ),
        crumb: 'test-token'
      }
    )
    const baseline = [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'View baseline details'
    )
    expect(baseline.getAttribute('href')).toContain('featureId=baseline-1')
    expect(document.querySelector('input[name=returnUrl]').value).toBe(
      returnUrl
    )
    expect(
      document.querySelector('.govuk-back-link').getAttribute('href')
    ).toBe(returnUrl)
  })

  test('explains when unavailable imported values will be cleared on save', () => {
    const imported = {
      ...createdAreaFeature,
      proposed: {
        ...createdAreaFeature.proposed,
        condition: 'Fairly Poor',
        advanceYears: 2.5
      }
    }
    renderTemplateIntoDocument(
      'habitat-details/pi-habitat-details-created-edit.njk',
      {
        ...buildCreatedAreaEditViewModel(imported, creationReference, ctx),
        crumb: 'test-token'
      }
    )
    expect(value('condition')).toBe('')
    expect(value('advanceYears')).toBe('')
    expect(text('condition-hint')).toContain('"Fairly Poor" is not available')
    expect(text('condition-hint')).toContain(
      'saving without a new selection will clear this value'
    )
    expect(text('advanceYears-hint')).toContain('"2.5" is not available')
  })

  test('retains 30+ selections while reading numeric stored years', () => {
    const feature = {
      ...createdAreaFeature,
      proposed: {
        ...createdAreaFeature.proposed,
        advanceYears: 30,
        advanceYearsIs30Plus: true
      }
    }
    expect(createdAreaValues(feature).advanceYears).toBe('30+')
    feature.proposed.advanceYearsIs30Plus = false
    expect(createdAreaValues(feature).advanceYears).toBe('30')
  })

  test.each(['Low', 'High'])(
    'keeps valid imported %s significance when incomplete units have no derived category',
    (strategicSignificance) => {
      const imported = {
        ...createdAreaFeature,
        units: null,
        status: 'Incomplete',
        proposed: {
          ...createdAreaFeature.proposed,
          advanceYears: null,
          strategicSignificance,
          strategicSignificanceCategory: null,
          strategicSignificanceScore: null
        }
      }
      renderTemplateIntoDocument(
        'habitat-details/pi-habitat-details-created-edit.njk',
        {
          ...buildCreatedAreaEditViewModel(imported, creationReference, ctx),
          crumb: 'test-token'
        }
      )
      expect(value('strategicSignificance')).toBe(strategicSignificance)
      expect(text('strategicSignificance-hint')).not.toContain('will clear')
    }
  )

  test('broad change resets type and condition but preserves independent choices', () => {
    change('broadHabitat', 'Urban')
    expect(value('habitatType')).toBe('')
    expect(value('condition')).toBe('')
    expect(value('strategicSignificance')).toBe('Low')
    expect(value('delayYears')).toBe('0')
    expect(text('distinctivenessDisplay')).toBe('')
    change('habitatType', 'Developed land; sealed surface')
    expect(text('distinctivenessDisplay')).toBe('Very low (0)')
    expect(text('standardDifficultyDisplay')).toBe('Low')
    expect(text('appliedDifficultyMultiplierDisplay')).toBe('1')
    expect(text('standardTimeToTargetDisplay')).toBe('')
    change('condition', 'N/A - Other')
    expect(text('finalTimeToTargetDisplay')).toBe('0 years (1)')
    change('broadHabitat', '')
    expect(document.querySelectorAll('#habitatType option')).toHaveLength(1)
    expect(document.querySelectorAll('#condition option')).toHaveLength(1)
    expect(document.body.textContent).toContain('11.68')
  })

  test('condition clearing retains type-derived fields and blanks time fields', () => {
    change('condition', '')
    expect(text('distinctivenessDisplay')).toBe('Low (2)')
    expect(text('standardTimeToTargetDisplay')).toBe('')
    expect(text('finalTimeToTargetDisplay')).toBe('')
    change('habitatType', '')
    expect(text('standardDifficultyDisplay')).toBe('')
    expect(text('appliedDifficultyMultiplierDisplay')).toBe('')
  })

  test('timing allows zero, blanks incomplete/conflicting inputs, and floors at zero', () => {
    change('advanceYears', '2')
    expect(text('finalTimeToTargetDisplay')).toBe('5 years (0.8368287006)')
    change('delayYears', '2')
    expect(value('advanceYears')).toBe('2')
    expect(text('finalTimeToTargetDisplay')).toBe('')
    change('advanceYears', '0')
    expect(text('finalTimeToTargetDisplay')).toBe('9 years (0.7256811131)')
    change('delayYears', '')
    expect(text('finalTimeToTargetDisplay')).toBe('')
    change('delayYears', '0')
    change('advanceYears', '30+')
    expect(text('finalTimeToTargetDisplay')).toBe('0 years (1)')
  })

  test('incomplete fields show null options and derived rows stay present', () => {
    render({
      ref: '',
      broadHabitat: '',
      habitatType: '',
      condition: '',
      strategicSignificance: '',
      advanceYears: '',
      delayYears: ''
    })
    for (const id of [
      'broadHabitat',
      'habitatType',
      'condition',
      'advanceYears',
      'delayYears'
    ]) {
      expect(value(id)).toBe('')
    }
    expect(document.getElementById('finalTimeToTargetDisplay')).not.toBeNull()
    expect(document.querySelector('button[type=submit]').textContent).toContain(
      'Save'
    )
  })

  test('error summary links and inline errors retain input, with one entry per rule', async () => {
    const values = {
      ...createdAreaValues(createdAreaFeature),
      ref: ' ',
      advanceYears: '2',
      delayYears: '3'
    }
    render(values, validateCreatedArea(values, creationReference))
    expect(
      document.querySelectorAll('.govuk-error-summary__list a')
    ).toHaveLength(2)
    expect(document.querySelectorAll('.govuk-error-message')).toHaveLength(2)
    expect(
      document.querySelector('.govuk-error-summary__title').textContent.trim()
    ).toBe('There is a problem')
    expect(
      [...document.querySelectorAll('.govuk-error-summary__list a')].map(
        (link) => ({
          text: link.textContent.trim(),
          href: link.getAttribute('href')
        })
      )
    ).toEqual([
      { text: 'You have entered an invalid habitat reference.', href: '#ref' },
      {
        text: 'A habitat cannot be created both in advance and with a delay.',
        href: '#advanceYears'
      }
    ])
    expect(document.getElementById('ref-error').textContent).toContain(
      'Enter a valid habitat reference.'
    )
    expect(document.getElementById('timing-error').textContent).toContain(
      'Either the advance or delay field must be set at zero.'
    )
    for (const id of ['advanceYears', 'delayYears']) {
      expect(document.getElementById(id).getAttribute('aria-describedby')).toBe(
        'timing-error'
      )
    }
    expect(value('advanceYears')).toBe('2')
    expect(value('delayYears')).toBe('3')
    await runAxeChecks(document.documentElement)
  })

  test('complete page meets accessibility checks', async () => {
    await runAxeChecks(document.documentElement)
  })

  test('matches the shared design labels, hint and timing group within Created-area scope', () => {
    expect(document.querySelector('label[for="ref"]').textContent.trim()).toBe(
      'Habitat reference'
    )
    expect(
      document
        .querySelector('label[for="strategicSignificance"]')
        .textContent.trim()
    ).toBe('Strategic significance (multiplier)')
    expect(
      document.getElementById('strategicSignificance-hint').textContent
    ).toContain('Local Nature Recovery Strategy (LNRS).')
    const timing = document.querySelector('fieldset')
    expect(timing.querySelector('legend').textContent.trim()).toBe(
      'Advance or delay?'
    )
    expect(timing.querySelectorAll('select')).toHaveLength(2)
    expect(
      document
        .querySelector('a.govuk-button')
        .classList.contains('govuk-button--secondary')
    ).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
    expect(text('interventionDisplay')).toBe('Created')
  })
})

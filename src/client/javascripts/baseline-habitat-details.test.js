// @vitest-environment happy-dom
import { initBaselineHabitatDetails } from './baseline-habitat-details.js'
import { renderTemplateIntoDocument } from '../../server/test-helpers/render-template.js'

const REFERENCE_DATA = {
  featureType: 'area',
  habitatTypes: [
    {
      name: 'Cereal crops',
      broad: 'Cropland',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    },
    {
      name: 'Bracken',
      broad: 'Grassland',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    },
    {
      name: 'Modified grassland',
      broad: 'Grassland',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    },
    {
      name: 'Developed land; sealed surface',
      broad: 'Urban',
      distinctiveness: 'V.Low',
      distinctivenessScore: 0
    }
  ],
  tradingRulesByBand: {
    Low: 'Same distinctiveness or better habitat required',
    'V.Low': 'Compensation Not Required',
    Medium: 'Same broad habitat or higher distinctiveness'
  }
}

const CONDITIONS_FIXTURE = [
  { condition: 'Good', score: 3 },
  { condition: 'Moderate', score: 2 },
  { condition: 'Poor', score: 1 }
]

// Builds the same view-model shape the area strategy passes to the
// template. The tests only care that the named element IDs exist and
// that #bhd-reference-data carries the right JSON; option lists are
// minimal but realistic so the rendered <select>s have the values the
// initial selection assertions reference.
function buildAreaViewModel({
  selectedBroad = 'Grassland',
  selectedType = 'Modified grassland',
  selectedCondition = 'Good'
} = {}) {
  const broads = ['Cropland', 'Grassland', 'Urban']
  const types = ['Bracken', 'Modified grassland']
  const conditions = CONDITIONS_FIXTURE
  return {
    pageTitle: 'Habitat 12',
    heading: 'Habitat 12',
    caption: 'Test Project',
    headingPrefix: 'Habitat',
    projectId: 'aa0e8400-e29b-41d4-a716-446655440000',
    projectName: 'Test Project',
    habitatRef: '12',
    sizeLabel: 'Area (hectares)',
    sizeDisplay: '2.5',
    showBroadHabitatRow: true,
    distinctivenessDisplay: 'Low (2)',
    strategicSignificanceDisplay: 'Low (1)',
    tradingRule: 'Same distinctiveness or better habitat required',
    habitatUnitsDisplay: '15.00',
    broadHabitatOptions: [
      { value: '', text: 'Choose broad habitat', selected: !selectedBroad },
      ...broads.map((value) => ({
        value,
        text: value,
        selected: value === selectedBroad
      }))
    ],
    habitatTypeOptions: [
      { value: '', text: 'Choose habitat type', selected: !selectedType },
      ...types.map((value) => ({
        value,
        text: value,
        selected: value === selectedType
      }))
    ],
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !selectedCondition },
      ...conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === selectedCondition
      }))
    ],
    referenceJson: JSON.stringify(REFERENCE_DATA),
    backHref: '/projects/test/habitat-list',
    cancelHref: '/projects/test/habitat-list#habitat-id',
    featureId: 'aa0e8400-e29b-41d4-a716-446655440001'
  }
}

function renderPage(overrides = {}) {
  renderTemplateIntoDocument(
    'habitat-details/habitat-details.njk',
    buildAreaViewModel(overrides)
  )
}

function fireChange(id) {
  const el = document.getElementById(id)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setValue(id, value) {
  const el = document.getElementById(id)
  el.value = value
}

function flushAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('initBaselineHabitatDetails', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(CONDITIONS_FIXTURE)
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Does not throw when reference data script is missing', () => {
    document.body.innerHTML = ''
    expect(() => initBaselineHabitatDetails()).not.toThrow()
  })

  test('Does not throw when reference data is malformed JSON', () => {
    document.body.innerHTML =
      '<script type="application/json" id="bhd-reference-data">not json</script>'
    expect(() => initBaselineHabitatDetails()).not.toThrow()
  })

  test('AC2: shows distinctiveness + trading rule for the new habitat type', async () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Bracken')
    fireChange('habitatType')
    await flushAsync()

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Low (2)'
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe(
      'Same distinctiveness or better habitat required'
    )
  })

  test('AC2: resets the condition dropdown when habitat type changes', async () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Bracken')
    fireChange('habitatType')
    await flushAsync()

    expect(document.getElementById('condition').value).toBe('')
  })

  test('AC2: fetches and populates condition options for the new habitat type', async () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Bracken')
    fireChange('habitatType')
    await flushAsync()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reference/conditions?habitatType=Grassland%20-%20Bracken',
      expect.anything()
    )
    const conditionOptions = Array.from(
      document.getElementById('condition').options
    )
    expect(conditionOptions.map((o) => o.value)).toEqual([
      '',
      'Good',
      'Moderate',
      'Poor'
    ])
  })

  test('AC3: hides distinctiveness + trading rule on type deselect', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('habitatType', '')
    fireChange('habitatType')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      ''
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe('')
  })

  test('AC4: changing broad habitat repopulates the type dropdown', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('broadHabitat', 'Cropland')
    fireChange('broadHabitat')

    const typeOptions = Array.from(
      document.getElementById('habitatType').options
    )
    expect(typeOptions.map((o) => o.value)).toEqual(['', 'Cereal crops'])
    expect(document.getElementById('habitatType').value).toBe('')
  })

  test('AC4: changing broad habitat hides distinctiveness + trading rule and resets condition', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('broadHabitat', 'Cropland')
    fireChange('broadHabitat')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      ''
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe('')
    expect(document.getElementById('condition').value).toBe('')
  })

  test('AC5: deselecting broad habitat clears the type dropdown to its default only', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('broadHabitat', '')
    fireChange('broadHabitat')

    const typeOptions = Array.from(
      document.getElementById('habitatType').options
    )
    expect(typeOptions.map((o) => o.value)).toEqual([''])
    expect(typeOptions[0].textContent).toBe('Choose habitat type')
  })

  test('AC5: deselecting broad habitat hides derived fields and resets condition', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('broadHabitat', '')
    fireChange('broadHabitat')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      ''
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe('')
    expect(document.getElementById('condition').value).toBe('')
  })

  test('Falls back to an empty condition list when fetch throws (network error)', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError('Network error'))
    )
    renderPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Bracken')
    fireChange('habitatType')
    await flushAsync()

    // Distinctiveness still updates (synchronous lookup from embedded data)
    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Low (2)'
    )
    // Condition dropdown is empty apart from the placeholder
    const options = Array.from(document.getElementById('condition').options)
    expect(options.map((o) => o.value)).toEqual([''])
  })

  test('AC1: changing condition does not alter derived fields or fetch', () => {
    renderPage()
    initBaselineHabitatDetails()

    setValue('condition', 'Poor')
    fireChange('condition')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Low (2)'
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

const HEDGEROW_REFERENCE_DATA = {
  featureType: 'hedgerow',
  habitatTypes: [
    {
      name: 'Native hedgerow',
      broad: null,
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    },
    {
      name: 'Line of trees',
      broad: null,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  ],
  tradingRulesByBand: {
    Medium: 'Same broad habitat or higher distinctiveness',
    Low: 'Same distinctiveness or better habitat required'
  }
}

// Mirrors the hedgerow strategy's view model: no broad-habitat dropdown,
// flat habitatTypes array embedded in #bhd-reference-data.
function buildHedgerowViewModel({
  selectedType = 'Native hedgerow',
  selectedCondition = 'Good'
} = {}) {
  const types = ['Native hedgerow', 'Line of trees']
  const conditions = CONDITIONS_FIXTURE
  return {
    pageTitle: 'Hedgerow H1',
    heading: 'Hedgerow H1',
    caption: 'Test Project',
    headingPrefix: 'Hedgerow',
    projectId: 'aa0e8400-e29b-41d4-a716-446655440000',
    projectName: 'Test Project',
    habitatRef: 'H1',
    sizeLabel: 'Length (km)',
    sizeDisplay: '1.234567',
    showBroadHabitatRow: false,
    distinctivenessDisplay: 'Medium (4)',
    strategicSignificanceDisplay: 'Low (1)',
    tradingRule: 'Same broad habitat or higher distinctiveness',
    habitatUnitsDisplay: '8.00',
    habitatTypeOptions: [
      { value: '', text: 'Choose habitat type', selected: !selectedType },
      ...types.map((value) => ({
        value,
        text: value,
        selected: value === selectedType
      }))
    ],
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !selectedCondition },
      ...conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === selectedCondition
      }))
    ],
    referenceJson: JSON.stringify(HEDGEROW_REFERENCE_DATA),
    backHref: '/projects/test/habitat-list#hedgerows',
    cancelHref: '/projects/test/habitat-list#hedgerows',
    featureId: 'bb0e8400-e29b-41d4-a716-446655440002'
  }
}

function renderHedgerowPage(overrides = {}) {
  renderTemplateIntoDocument(
    'habitat-details/habitat-details.njk',
    buildHedgerowViewModel(overrides)
  )
}

describe('initBaselineHabitatDetails — hedgerow variant', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(CONDITIONS_FIXTURE)
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('AC2: shows distinctiveness + trading rule for the new hedgerow habitat type', async () => {
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Line of trees')
    fireChange('habitatType')
    await flushAsync()

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Low (2)'
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe(
      'Same distinctiveness or better habitat required'
    )
  })

  test('AC2: resets the condition dropdown when hedgerow habitat type changes', async () => {
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Line of trees')
    fireChange('habitatType')
    await flushAsync()

    expect(document.getElementById('condition').value).toBe('')
  })

  test('AC2: fetches conditions for the new type with featureType=hedgerow', async () => {
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Line of trees')
    fireChange('habitatType')
    await flushAsync()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reference/conditions?habitatType=Line%20of%20trees&featureType=hedgerow',
      expect.anything()
    )
    const conditionOptions = Array.from(
      document.getElementById('condition').options
    )
    expect(conditionOptions.map((o) => o.value)).toEqual([
      '',
      'Good',
      'Moderate',
      'Poor'
    ])
  })

  test('AC3: deselecting habitat type clears distinctiveness, trading rule, and condition without fetching', () => {
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('habitatType', '')
    fireChange('habitatType')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      ''
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe('')
    expect(document.getElementById('condition').value).toBe('')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('AC1: changing condition does not alter derived fields or fetch', () => {
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('condition', 'Poor')
    fireChange('condition')

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Medium (4)'
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('Falls back to empty condition list when fetch throws (network error)', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError('Network error'))
    )
    renderHedgerowPage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Line of trees')
    fireChange('habitatType')
    await flushAsync()

    // Distinctiveness still updates synchronously from embedded data
    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'Low (2)'
    )
    const options = Array.from(document.getElementById('condition').options)
    expect(options.map((o) => o.value)).toEqual([''])
  })
})

const WATERCOURSE_REFERENCE_DATA = {
  featureType: 'watercourse',
  habitatTypes: [
    {
      name: 'Other rivers and streams',
      broad: null,
      distinctiveness: 'High',
      distinctivenessScore: 8
    },
    {
      name: 'Headwaters',
      broad: null,
      distinctiveness: 'V.High',
      distinctivenessScore: 10
    }
  ],
  tradingRulesByBand: {
    High: 'Same broad habitat or higher distinctiveness',
    'V.High': 'Same habitat required'
  },
  watercourseEncroachments: ['None', 'Minor'],
  riparianEncroachments: ['None', 'Minor']
}

// Mirrors the watercourse strategy's view model. It renders a placeholder
// broad-habitat row (per the BMD-502 story spec) — these tests cover the
// regression where that row tricked the client JS into the area code path,
// which built a malformed lookup key and omitted featureType=watercourse,
// leaving the condition dropdown empty.
function buildWatercourseViewModel({
  selectedType = 'Other rivers and streams',
  selectedCondition = 'Fairly Poor'
} = {}) {
  const types = ['Other rivers and streams', 'Headwaters']
  const conditions = CONDITIONS_FIXTURE
  return {
    pageTitle: 'Watercourse R1',
    heading: 'Watercourse R1',
    caption: 'Test Project',
    headingPrefix: 'Watercourse',
    projectId: 'aa0e8400-e29b-41d4-a716-446655440000',
    projectName: 'Test Project',
    habitatRef: 'R1',
    sizeLabel: 'Length (km)',
    sizeDisplay: '0.085',
    showBroadHabitatRow: true,
    broadHabitatOptions: [
      { value: '', text: 'Choose broad habitat', selected: true }
    ],
    showWatercourseEncroachmentRows: true,
    distinctivenessDisplay: 'High (8)',
    strategicSignificanceDisplay: 'Low (1)',
    tradingRule: 'Same broad habitat or higher distinctiveness',
    habitatUnitsDisplay: '0.77',
    habitatTypeOptions: [
      { value: '', text: 'Choose habitat type', selected: !selectedType },
      ...types.map((value) => ({
        value,
        text: value,
        selected: value === selectedType
      }))
    ],
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !selectedCondition },
      ...conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === selectedCondition
      }))
    ],
    watercourseEncroachmentOptions: [
      { value: '', text: 'Choose watercourse encroachment', selected: true }
    ],
    riparianEncroachmentOptions: [
      { value: '', text: 'Choose riparian encroachment', selected: true }
    ],
    referenceJson: JSON.stringify(WATERCOURSE_REFERENCE_DATA),
    backHref: '/projects/test/baseline-habitat-list#watercourses',
    cancelHref: '/projects/test/baseline-habitat-list#watercourses',
    featureId: 'cc0e8400-e29b-41d4-a716-446655440003'
  }
}

function renderWatercoursePage(overrides = {}) {
  renderTemplateIntoDocument(
    'habitat-details/habitat-details.njk',
    buildWatercourseViewModel(overrides)
  )
}

describe('initBaselineHabitatDetails — watercourse variant', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(CONDITIONS_FIXTURE)
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches conditions for the new type with featureType=watercourse (regression: was hitting the area code path and returning empty)', async () => {
    renderWatercoursePage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Headwaters')
    fireChange('habitatType')
    await flushAsync()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reference/conditions?habitatType=Headwaters&featureType=watercourse',
      expect.anything()
    )
    const conditionOptions = Array.from(
      document.getElementById('condition').options
    )
    expect(conditionOptions.map((o) => o.value)).toEqual([
      '',
      'Good',
      'Moderate',
      'Poor'
    ])
  })

  test('shows distinctiveness + trading rule for the new watercourse type', async () => {
    renderWatercoursePage()
    initBaselineHabitatDetails()

    setValue('habitatType', 'Headwaters')
    fireChange('habitatType')
    await flushAsync()

    expect(document.getElementById('distinctivenessDisplay').textContent).toBe(
      'V.High (10)'
    )
    expect(document.getElementById('tradingRuleDisplay').textContent).toBe(
      'Same habitat required'
    )
  })

  test('changing the placeholder broad-habitat dropdown does not trigger a fetch (no area handler wired)', () => {
    renderWatercoursePage()
    initBaselineHabitatDetails()

    setValue('broadHabitat', '')
    fireChange('broadHabitat')

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

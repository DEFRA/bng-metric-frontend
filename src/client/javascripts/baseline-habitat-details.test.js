// @vitest-environment happy-dom
import { initBaselineHabitatDetails } from './baseline-habitat-details.js'

const REFERENCE_DATA = {
  habitatTypesByBroad: {
    Cropland: [
      { name: 'Cereal crops', distinctiveness: 'Low', distinctivenessScore: 2 }
    ],
    Grassland: [
      { name: 'Bracken', distinctiveness: 'Low', distinctivenessScore: 2 },
      {
        name: 'Modified grassland',
        distinctiveness: 'Low',
        distinctivenessScore: 2
      }
    ],
    Urban: [
      {
        name: 'Developed land; sealed surface',
        distinctiveness: 'V.Low',
        distinctivenessScore: 0
      }
    ]
  },
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

function renderPage({
  selectedBroad = 'Grassland',
  selectedType = 'Modified grassland',
  selectedCondition = 'Good'
} = {}) {
  document.body.innerHTML = `
    <select id="broadHabitat">
      <option value="">Choose broad habitat</option>
      <option value="Cropland">Cropland</option>
      <option value="Grassland">Grassland</option>
      <option value="Urban">Urban</option>
    </select>
    <select id="habitatType">
      <option value="">Choose habitat type</option>
      <option value="Bracken">Bracken</option>
      <option value="Modified grassland">Modified grassland</option>
    </select>
    <select id="condition">
      <option value="">Choose condition</option>
      <option value="Good">Good (3)</option>
      <option value="Poor">Poor (1)</option>
    </select>
    <span id="distinctivenessDisplay">Low (2)</span>
    <span id="tradingRuleDisplay">Same distinctiveness or better habitat required</span>
    <script type="application/json" id="bhd-reference-data">${JSON.stringify(REFERENCE_DATA)}</script>
  `
  document.getElementById('broadHabitat').value = selectedBroad
  document.getElementById('habitatType').value = selectedType
  document.getElementById('condition').value = selectedCondition
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
  habitatTypes: [
    {
      name: 'Native hedgerow',
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    },
    {
      name: 'Line of trees',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  ],
  tradingRulesByBand: {
    Medium: 'Same broad habitat or higher distinctiveness',
    Low: 'Same distinctiveness or better habitat required'
  }
}

// Hedgerow variant: no broad habitat dropdown, flat habitatTypes array.
// initBaselineHabitatDetails branches on the absence of #broadHabitat.
function renderHedgerowPage({
  selectedType = 'Native hedgerow',
  selectedCondition = 'Good'
} = {}) {
  document.body.innerHTML = `
    <select id="habitatType">
      <option value="">Choose habitat type</option>
      <option value="Native hedgerow">Native hedgerow</option>
      <option value="Line of trees">Line of trees</option>
    </select>
    <select id="condition">
      <option value="">Choose condition</option>
      <option value="Good">Good (3)</option>
      <option value="Poor">Poor (1)</option>
    </select>
    <span id="distinctivenessDisplay">Medium (4)</span>
    <span id="tradingRuleDisplay">Same broad habitat or higher distinctiveness</span>
    <script type="application/json" id="bhd-reference-data">${JSON.stringify(HEDGEROW_REFERENCE_DATA)}</script>
  `
  document.getElementById('habitatType').value = selectedType
  document.getElementById('condition').value = selectedCondition
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

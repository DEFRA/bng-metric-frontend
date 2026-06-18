import { wreck } from '../../common/helpers/wreck-client.js'
import { watercourseStrategy, _resetReferenceCache } from './watercourse.js'

vi.mock('../../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

const mockWatercourseTypes = [
  {
    name: 'Ditches',
    distinctiveness: 'Medium',
    distinctivenessScore: 4
  },
  {
    name: 'Other rivers and streams',
    distinctiveness: 'High',
    distinctivenessScore: 6
  },
  {
    name: 'Priority habitat',
    distinctiveness: 'V.High',
    distinctivenessScore: 8
  }
]
const mockConditions = [
  { condition: 'Good', score: 3 },
  { condition: 'Moderate', score: 2 },
  { condition: 'Poor', score: 1 }
]
const mockTradingRules = {
  'V.High': 'Same habitat required - bespoke compensation option',
  High: 'Same habitat required =',
  Medium: 'Same habitat required =',
  Low: 'Better distinctiveness habitat required'
}
const mockWatercourseEncroachments = [
  'No Encroachment',
  'Minor',
  'Major',
  'N/A - Culvert'
]
const mockRiparianEncroachments = [
  'Major/Major',
  'Major/Moderate',
  'Major/Minor',
  'Major/No Encroachment',
  'Moderate/Moderate',
  'Moderate/Minor',
  'Moderate/No Encroachment',
  'Minor/Minor',
  'Minor/No Encroachment',
  'No Encroachment/No Encroachment',
  'N/A - Culvert'
]

function routeWreck(url) {
  if (url.endsWith('/reference/watercourse-types')) {
    return { res: { statusCode: 200 }, payload: mockWatercourseTypes }
  }
  if (url.includes('/reference/conditions')) {
    return { res: { statusCode: 200 }, payload: mockConditions }
  }
  if (url.includes('/reference/trading-rules')) {
    return { res: { statusCode: 200 }, payload: mockTradingRules }
  }
  if (url.endsWith('/reference/watercourse-encroachments')) {
    return {
      res: { statusCode: 200 },
      payload: {
        watercourse: mockWatercourseEncroachments,
        riparian: mockRiparianEncroachments
      }
    }
  }
  return { res: { statusCode: 404 }, payload: null }
}

beforeEach(() => {
  _resetReferenceCache()
  vi.mocked(wreck.get).mockImplementation((u) => Promise.resolve(routeWreck(u)))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('watercourseStrategy.loadReference', () => {
  test('fetches types, conditions, trading rules, and encroachment lists', async () => {
    const reference = await watercourseStrategy.loadReference({
      type: 'Priority habitat'
    })

    expect(reference.habitatTypes).toEqual(
      mockWatercourseTypes.map((t) => ({ ...t, broad: null }))
    )
    expect(reference.conditions).toEqual(mockConditions)
    expect(reference.tradingRules).toEqual(mockTradingRules)
    expect(reference.watercourseEncroachments).toEqual(
      mockWatercourseEncroachments
    )
    expect(reference.riparianEncroachments).toEqual(mockRiparianEncroachments)
  })

  test('passes featureType=watercourse to the conditions endpoint', async () => {
    await watercourseStrategy.loadReference({ type: 'Priority habitat' })

    const conditionsCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionsCall[0]).toContain('featureType=watercourse')
    expect(conditionsCall[0]).toContain(
      `habitatType=${encodeURIComponent('Priority habitat')}`
    )
  })

  test('asks the trading-rules endpoint for the watercourse-specific text', async () => {
    await watercourseStrategy.loadReference({ type: 'Priority habitat' })

    const tradingRulesCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/trading-rules'))
    expect(tradingRulesCall[0]).toContain('featureType=watercourse')
  })

  test('skips the conditions call when the watercourse has no saved type', async () => {
    const reference = await watercourseStrategy.loadReference({ type: null })

    expect(reference.conditions).toEqual([])
    const conditionsCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionsCall).toBeUndefined()
  })
})

describe('watercourseStrategy.buildViewModel', () => {
  const ctx = { projectId: 'project-uuid', projectName: 'Project Name' }
  const reference = {
    habitatTypes: mockWatercourseTypes,
    conditions: mockConditions,
    tradingRules: mockTradingRules,
    watercourseEncroachments: mockWatercourseEncroachments,
    riparianEncroachments: mockRiparianEncroachments
  }

  test('uses "Watercourse" as the heading prefix', () => {
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    expect(vm.headingPrefix).toBe('Watercourse')
  })

  test('omits the broad habitat row (not a valid field for watercourses)', () => {
    // Broad habitat is not a valid dimension for watercourses (the engine's
    // watercourse habitat-type table is flat).
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    expect(vm.showBroadHabitatRow).toBe(false)
    expect(vm.broadHabitatOptions).toBeUndefined()
  })

  test('flags watercourse-encroachment rows for the shell template', () => {
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    expect(vm.showWatercourseEncroachmentRows).toBe(true)
  })

  test('formats length in km to 7 significant figures', () => {
    const watercourse = { featureId: 'w-1', ref: 'W1', sizeMetres: 1234.567 }
    const vm = watercourseStrategy.buildViewModel(watercourse, reference, ctx)
    expect(vm.sizeLabel).toBe('Length (km)')
    expect(vm.sizeDisplay).toBe('1.234567')
  })

  test('renders distinctiveness as "band (score)" when both are present', () => {
    const watercourse = {
      featureId: 'w-1',
      distinctiveness: 'V.High',
      distinctivenessScore: 8
    }
    const vm = watercourseStrategy.buildViewModel(watercourse, reference, ctx)
    expect(vm.distinctivenessDisplay).toBe('V.High (8)')
  })

  test('renders strategic significance as the fixed "Low (1)" for MVS', () => {
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    expect(vm.strategicSignificanceDisplay).toBe('Low (1)')
  })

  test('marks the saved habitat type as selected in the dropdown', () => {
    const vm = watercourseStrategy.buildViewModel(
      { type: 'Priority habitat' },
      reference,
      ctx
    )
    const selected = vm.habitatTypeOptions.find((o) => o.selected)
    expect(selected.value).toBe('Priority habitat')
  })

  test('matches the saved condition even when the stored value carries a "N. " prefix', () => {
    const vm = watercourseStrategy.buildViewModel(
      { condition: '3. Moderate' },
      reference,
      ctx
    )
    const selected = vm.conditionOptions.find((o) => o.selected)
    expect(selected.value).toBe('Moderate')
  })

  test('marks the saved riparian encroachment as selected', () => {
    const vm = watercourseStrategy.buildViewModel(
      { riparianEncroachment: 'Minor/Minor' },
      reference,
      ctx
    )
    const selected = vm.riparianEncroachmentOptions.find((o) => o.selected)
    expect(selected.value).toBe('Minor/Minor')
  })

  test('marks the saved watercourse encroachment as selected', () => {
    const vm = watercourseStrategy.buildViewModel(
      { watercourseEncroachment: 'Minor' },
      reference,
      ctx
    )
    const selected = vm.watercourseEncroachmentOptions.find((o) => o.selected)
    expect(selected.value).toBe('Minor')
  })

  test('renders the placeholder option when no encroachment is saved', () => {
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    expect(vm.riparianEncroachmentOptions[0]).toMatchObject({
      value: '',
      text: 'Choose riparian encroachment',
      selected: true
    })
    expect(vm.watercourseEncroachmentOptions[0]).toMatchObject({
      value: '',
      text: 'Choose watercourse encroachment',
      selected: true
    })
  })

  test('exposes engine-order encroachment options in the dropdown', () => {
    const vm = watercourseStrategy.buildViewModel({}, reference, ctx)
    // Strip the placeholder before comparing.
    expect(
      vm.watercourseEncroachmentOptions.slice(1).map((o) => o.value)
    ).toEqual(mockWatercourseEncroachments)
    expect(vm.riparianEncroachmentOptions.slice(1).map((o) => o.value)).toEqual(
      mockRiparianEncroachments
    )
  })

  test('picks the watercourse trading rule for the saved distinctiveness', () => {
    const vm = watercourseStrategy.buildViewModel(
      { distinctiveness: 'V.High' },
      reference,
      ctx
    )
    expect(vm.tradingRule).toBe(
      'Same habitat required - bespoke compensation option'
    )
  })

  test('back and cancel hrefs return to the watercourses tab on the habitat list', () => {
    const vm = watercourseStrategy.buildViewModel(
      { featureId: 'w-1' },
      reference,
      ctx
    )
    expect(vm.backHref).toBe(
      '/projects/project-uuid/baseline-habitat-list#watercourses'
    )
    expect(vm.cancelHref).toBe(
      '/projects/project-uuid/baseline-habitat-list#watercourses'
    )
  })
})

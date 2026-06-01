import { wreck } from '../../common/helpers/wreck-client.js'
import { hedgerowStrategy, _resetReferenceCache } from './hedgerow.js'

vi.mock('../../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

const mockHedgerowTypes = [
  { name: 'Native hedgerow', distinctiveness: 'Low', distinctivenessScore: 2 },
  {
    name: 'Species-rich native hedgerow',
    distinctiveness: 'Medium',
    distinctivenessScore: 4
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
  Medium: 'Same broad habitat or a higher distinctiveness habitat required (≥)',
  Low: 'Same distinctiveness or better habitat required ≥',
  'V.Low': 'Compensation Not Required'
}

function routeWreck(url) {
  if (url.endsWith('/reference/hedgerow-types')) {
    return { res: { statusCode: 200 }, payload: mockHedgerowTypes }
  }
  if (url.includes('/reference/conditions')) {
    return { res: { statusCode: 200 }, payload: mockConditions }
  }
  if (url.endsWith('/reference/trading-rules')) {
    return { res: { statusCode: 200 }, payload: mockTradingRules }
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

describe('hedgerowStrategy.loadReference', () => {
  test('fetches hedgerow types, conditions (for the saved type), and trading rules', async () => {
    const reference = await hedgerowStrategy.loadReference({
      type: 'Native hedgerow'
    })

    expect(reference.habitatTypes).toEqual(mockHedgerowTypes)
    expect(reference.conditions).toEqual(mockConditions)
    expect(reference.tradingRules).toEqual(mockTradingRules)
  })

  test('passes featureType=hedgerow to the conditions endpoint', async () => {
    await hedgerowStrategy.loadReference({ type: 'Native hedgerow' })

    const conditionsCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionsCall[0]).toContain('featureType=hedgerow')
    expect(conditionsCall[0]).toContain(
      `habitatType=${encodeURIComponent('Native hedgerow')}`
    )
  })

  test('skips the conditions call when the hedgerow has no saved type', async () => {
    const reference = await hedgerowStrategy.loadReference({ type: null })

    expect(reference.conditions).toEqual([])
    const conditionsCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionsCall).toBeUndefined()
  })
})

describe('hedgerowStrategy.buildViewModel', () => {
  const ctx = { projectId: 'project-uuid', projectName: 'Project Name' }
  const reference = {
    habitatTypes: mockHedgerowTypes,
    conditions: mockConditions,
    tradingRules: mockTradingRules
  }

  test('formats length in km to 7 significant figures', () => {
    const hedgerow = { featureId: 'h-1', ref: 'H1', sizeMetres: 1234.567 }
    const vm = hedgerowStrategy.buildViewModel(hedgerow, reference, ctx)
    expect(vm.sizeLabel).toBe('Length (km)')
    expect(vm.sizeDisplay).toBe('1.234567')
  })

  test('uses "Hedgerow" as the heading prefix and omits the broad habitat row', () => {
    const vm = hedgerowStrategy.buildViewModel({}, reference, ctx)
    expect(vm.headingPrefix).toBe('Hedgerow')
    expect(vm.showBroadHabitatRow).toBe(false)
  })

  test('renders distinctiveness as "band (score)" when both are present', () => {
    const hedgerow = {
      featureId: 'h-1',
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    }
    const vm = hedgerowStrategy.buildViewModel(hedgerow, reference, ctx)
    expect(vm.distinctivenessDisplay).toBe('Medium (4)')
  })

  test('renders strategic significance as the fixed "Low (1)" for MVS', () => {
    const vm = hedgerowStrategy.buildViewModel({}, reference, ctx)
    expect(vm.strategicSignificanceDisplay).toBe('Low (1)')
  })

  test('marks the saved habitat type as selected in the dropdown', () => {
    const vm = hedgerowStrategy.buildViewModel(
      { type: 'Native hedgerow' },
      reference,
      ctx
    )
    const selected = vm.habitatTypeOptions.find((o) => o.selected)
    expect(selected.value).toBe('Native hedgerow')
  })

  test('back and cancel hrefs return to the hedgerows tab on the habitat list', () => {
    const vm = hedgerowStrategy.buildViewModel(
      { featureId: 'h-1' },
      reference,
      ctx
    )
    expect(vm.backHref).toBe('/projects/project-uuid/habitat-list#hedgerows')
    expect(vm.cancelHref).toBe('/projects/project-uuid/habitat-list#hedgerows')
  })
})

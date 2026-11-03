import { wreck } from '../../common/helpers/wreck-client.js'
import { _resetReferenceCache } from './area.js'
import { getStrategy } from './index.js'
import { verticalStrategy } from './vertical.js'

vi.mock('../../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

const typesByBroad = {
  Grassland: [{ name: 'Modified grassland', distinctiveness: 'Low' }],
  Urban: [
    { name: 'Allotments', distinctiveness: 'Low' },
    { name: 'Facade-bound green wall', distinctiveness: 'Low' },
    { name: 'Ground based green wall', distinctiveness: 'Low' }
  ],
  'Intertidal hard structures': [
    { name: 'Artificial hard structures', distinctiveness: 'Low' }
  ]
}
const conditions = [
  { condition: 'Moderate', score: 2 },
  { condition: 'Poor', score: 1 }
]

function routeWreck(url) {
  if (url.endsWith('/reference/habitat-types-by-broad')) {
    return { res: { statusCode: 200 }, payload: typesByBroad }
  }
  if (url.includes('/reference/conditions')) {
    return { res: { statusCode: 200 }, payload: conditions }
  }
  if (url.endsWith('/reference/trading-rules')) {
    return { res: { statusCode: 200 }, payload: {} }
  }
  return { res: { statusCode: 404 }, payload: null }
}

const wall = {
  featureId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ref: 'V-1',
  broadType: 'Urban',
  type: 'Facade-bound green wall',
  condition: 'Poor',
  sizeSquareMetres: 37.5,
  units: 0.0075
}

beforeEach(() => {
  _resetReferenceCache()
  vi.mocked(wreck.get).mockImplementation((u) => Promise.resolve(routeWreck(u)))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verticalStrategy', () => {
  test('is the strategy for a vertical area habitat', () => {
    expect(getStrategy('verticalHabitat')).toBe(verticalStrategy)
  })

  test('offers only the habitats the Metric counts by vertical area', async () => {
    const reference = await verticalStrategy.loadReference(wall)

    expect(reference.broadHabitats).toEqual([
      'Intertidal hard structures',
      'Urban'
    ])
    expect(reference.habitatTypes.map((t) => t.name)).toEqual([
      'Facade-bound green wall',
      'Ground based green wall',
      'Artificial hard structures'
    ])
    expect(reference.conditions).toEqual(conditions)
  })

  test('shows the face area in square metres, as entered', async () => {
    const reference = await verticalStrategy.loadReference(wall)
    const viewModel = verticalStrategy.buildViewModel(wall, reference, {
      projectId: 'p1',
      projectName: 'Riverside'
    })

    expect(viewModel).toMatchObject({
      habitatRef: 'V-1',
      sizeDisplay: '37.5m²',
      sizeLabel: 'Size (square metres)',
      backHref: '/projects/p1/area-baseline'
    })
    expect(viewModel.habitatTypeOptions.map((o) => o.value)).toEqual([
      '',
      'Facade-bound green wall',
      'Ground based green wall'
    ])
  })
})

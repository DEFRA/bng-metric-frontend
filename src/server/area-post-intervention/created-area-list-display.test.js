import { prepareCreatedAreaListDisplay } from './created-area-list-display.js'
import { loadCreatedAreaReference } from '../post-intervention-habitat-details/created-edit-reference.js'

vi.mock(
  '../post-intervention-habitat-details/created-edit-reference.js',
  () => ({ loadCreatedAreaReference: vi.fn() })
)

const reference = {
  habitatTypes: [
    {
      name: 'Ponds (non-priority habitat)',
      broad: 'Lakes',
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    }
  ],
  strategicSignificance: [
    { value: 'Low', score: 1 },
    { value: 'High', score: 1.15 }
  ]
}
const feature = {
  ref: 'P2-7',
  retentionCategory: 'Created',
  units: null,
  status: 'Incomplete',
  sizeSquareMetres: 242.8732997,
  proposed: {
    broadType: 'Lakes',
    type: 'Ponds (non-priority habitat)',
    condition: null,
    distinctiveness: null,
    distinctivenessScore: null,
    strategicSignificance: 'Low',
    strategicSignificanceCategory: null,
    strategicSignificanceScore: null
  }
}
const projectWith = (feature) => ({ postIntervention: { habitats: [feature] } })
beforeEach(() =>
  vi.mocked(loadCreatedAreaReference).mockResolvedValue(reference)
)

test('derives independently known fields for an incomplete pond without changing its units, status or stored project', async () => {
  const project = projectWith(structuredClone(feature))
  const snapshot = structuredClone(project)
  const displayed = await prepareCreatedAreaListDisplay(project)
  expect(displayed.postIntervention.habitats[0]).toMatchObject({
    units: null,
    status: 'Incomplete',
    proposed: {
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      strategicSignificanceCategory: 'Low',
      strategicSignificanceScore: 1,
      condition: null
    }
  })
  expect(project).toEqual(snapshot)
})

test.each([null, '', 'Medium', 'Unknown'])(
  'does not invent strategic significance from habitat type when the saved value is %j',
  async (value) => {
    const project = projectWith({
      ...feature,
      proposed: {
        ...feature.proposed,
        strategicSignificance: value,
        rejectedStrategicSignificance: 'Medium'
      }
    })
    const displayed = (await prepareCreatedAreaListDisplay(project))
      .postIntervention.habitats[0]
    expect(displayed.proposed.distinctiveness).toBe('Medium')
    expect(displayed.proposed.strategicSignificanceCategory).toBeNull()
    expect(displayed.proposed.strategicSignificanceScore).toBeNull()
  }
)

test('recognises supported legacy significance labels even when other unit inputs are missing', async () => {
  const project = projectWith({
    ...feature,
    proposed: {
      ...feature.proposed,
      strategicSignificance: 'Formally identified in local strategy'
    }
  })
  expect(
    (await prepareCreatedAreaListDisplay(project)).postIntervention.habitats[0]
      .proposed
  ).toMatchObject({
    strategicSignificanceCategory: 'High',
    strategicSignificanceScore: 1.15
  })
})

test('does not use a different broad habitat or unknown habitat type to supply distinctiveness', async () => {
  for (const proposed of [
    { ...feature.proposed, broadType: 'Urban' },
    { ...feature.proposed, type: 'Unknown' }
  ]) {
    const displayed = (
      await prepareCreatedAreaListDisplay(projectWith({ ...feature, proposed }))
    ).postIntervention.habitats[0]
    expect(displayed.proposed.distinctiveness).toBeNull()
    expect(displayed.proposed.strategicSignificanceCategory).toBe('Low')
  }
})

test('does not load reference data for complete saved fields or other intervention types', async () => {
  for (const row of [
    { ...feature, retentionCategory: 'Enhanced' },
    {
      ...feature,
      proposed: {
        ...feature.proposed,
        distinctiveness: 'Medium',
        distinctivenessScore: 4,
        strategicSignificanceCategory: 'Low',
        strategicSignificanceScore: 1
      }
    }
  ]) {
    const project = projectWith(row)
    expect(await prepareCreatedAreaListDisplay(project)).toBe(project)
  }
  expect(loadCreatedAreaReference).not.toHaveBeenCalled()
})

test('uses the same legacy root type and broad habitat fallback as the displayed row', async () => {
  const legacy = {
    ...feature,
    type: feature.proposed.type,
    broadType: 'Lakes',
    proposed: { ...feature.proposed, type: '', broadType: '' }
  }
  expect(
    (await prepareCreatedAreaListDisplay(projectWith(legacy))).postIntervention
      .habitats[0].proposed
  ).toMatchObject({ distinctiveness: 'Medium', distinctivenessScore: 4 })
})

test('keeps an explicit cleared significance and a zero distinctiveness score', async () => {
  const stored = {
    ...feature,
    proposed: {
      ...feature.proposed,
      distinctiveness: 'Very low',
      distinctivenessScore: 0,
      strategicSignificanceCategory: '',
      strategicSignificanceScore: null
    }
  }
  const displayed = (await prepareCreatedAreaListDisplay(projectWith(stored)))
    .postIntervention.habitats[0]
  expect(displayed.proposed).toMatchObject({
    distinctiveness: 'Very low',
    distinctivenessScore: 0,
    strategicSignificanceCategory: '',
    strategicSignificanceScore: null
  })
})

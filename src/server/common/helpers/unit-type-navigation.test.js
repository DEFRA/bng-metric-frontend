import { buildUnitTypeNavigation } from './unit-type-navigation.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('buildUnitTypeNavigation', () => {
  test('always includes Summary and Area habitats', () => {
    const items = buildUnitTypeNavigation({}, PROJECT_ID, 'Area habitats')

    expect(items).toEqual([
      { text: 'Summary', href: `/projects/${PROJECT_ID}/project-summary` },
      { text: 'Area habitats', current: true }
    ])
  })

  test('includes Hedgerows only when the project has hedgerow habitats', () => {
    const withHedgerows = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}] } },
      PROJECT_ID,
      'Area habitats'
    )

    expect(withHedgerows).toContainEqual({
      text: 'Hedgerows',
      href: `/projects/${PROJECT_ID}/hedgerows-summary`
    })

    const withoutHedgerows = buildUnitTypeNavigation(
      {},
      PROJECT_ID,
      'Area habitats'
    )

    expect(withoutHedgerows.some((item) => item.text === 'Hedgerows')).toBe(
      false
    )
  })

  test('includes Watercourses only when the project has watercourse habitats', () => {
    const withWatercourses = buildUnitTypeNavigation(
      { postIntervention: { watercourses: [{}] } },
      PROJECT_ID,
      'Area habitats'
    )

    expect(withWatercourses).toContainEqual({
      text: 'Watercourses',
      href: `/projects/${PROJECT_ID}/watercourses-summary`
    })

    const withoutWatercourses = buildUnitTypeNavigation(
      {},
      PROJECT_ID,
      'Area habitats'
    )

    expect(
      withoutWatercourses.some((item) => item.text === 'Watercourses')
    ).toBe(false)
  })

  test('marks the current item as current and strips its href', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}], watercourses: [{}] } },
      PROJECT_ID,
      'Hedgerows'
    )
    const hedgerowsItem = items.find((item) => item.text === 'Hedgerows')
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')

    expect(hedgerowsItem).toEqual({ text: 'Hedgerows', current: true })
    expect(areaHabitatsItem).toEqual({
      text: 'Area habitats',
      href: `/projects/${PROJECT_ID}/area-summary`
    })
  })
})

import { buildUnitTypeNavigation } from './unit-type-navigation.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_SUMMARY_HREF = `/projects/${PROJECT_ID}/project-summary`
const AREA_SUMMARY_HREF = `/projects/${PROJECT_ID}/area-summary`
const AREA_BASELINE_HREF = `/projects/${PROJECT_ID}/area-baseline`
const HEDGEROWS_SUMMARY_HREF = `/projects/${PROJECT_ID}/hedgerows-summary`
const WATERCOURSES_SUMMARY_HREF = `/projects/${PROJECT_ID}/watercourses-summary`

describe('buildUnitTypeNavigation', () => {
  test('always includes Summary and Area habitats', () => {
    const items = buildUnitTypeNavigation({}, PROJECT_ID, AREA_SUMMARY_HREF)

    expect(items).toEqual([
      { text: 'Summary', href: PROJECT_SUMMARY_HREF },
      {
        text: 'Area habitats',
        current: true,
        children: [{ text: 'Baseline', href: AREA_BASELINE_HREF }]
      }
    ])
  })

  test('includes Hedgerows only when the project has hedgerow habitats', () => {
    const withHedgerows = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}] } },
      PROJECT_ID,
      AREA_SUMMARY_HREF
    )

    expect(withHedgerows).toContainEqual({
      text: 'Hedgerows',
      href: HEDGEROWS_SUMMARY_HREF
    })

    const withoutHedgerows = buildUnitTypeNavigation(
      {},
      PROJECT_ID,
      AREA_SUMMARY_HREF
    )

    expect(withoutHedgerows.some((item) => item.text === 'Hedgerows')).toBe(
      false
    )
  })

  test('includes Watercourses only when the project has watercourse habitats', () => {
    const withWatercourses = buildUnitTypeNavigation(
      { postIntervention: { watercourses: [{}] } },
      PROJECT_ID,
      AREA_SUMMARY_HREF
    )

    expect(withWatercourses).toContainEqual({
      text: 'Watercourses',
      href: WATERCOURSES_SUMMARY_HREF
    })

    const withoutWatercourses = buildUnitTypeNavigation(
      {},
      PROJECT_ID,
      AREA_SUMMARY_HREF
    )

    expect(
      withoutWatercourses.some((item) => item.text === 'Watercourses')
    ).toBe(false)
  })

  test('marks the current item as current and strips its href', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}], watercourses: [{}] } },
      PROJECT_ID,
      HEDGEROWS_SUMMARY_HREF
    )
    const hedgerowsItem = items.find((item) => item.text === 'Hedgerows')

    expect(hedgerowsItem).toEqual({ text: 'Hedgerows', current: true })
  })

  test('marks Baseline as current without stripping the Area habitats href', () => {
    const items = buildUnitTypeNavigation({}, PROJECT_ID, AREA_BASELINE_HREF)
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')

    expect(areaHabitatsItem.href).toBe(AREA_SUMMARY_HREF)
    expect(areaHabitatsItem.current).toBeUndefined()
    expect(areaHabitatsItem.children).toEqual([
      { text: 'Baseline', current: true }
    ])
  })

  test('expands Area habitats on both its summary and its baseline page', () => {
    for (const currentHref of [AREA_SUMMARY_HREF, AREA_BASELINE_HREF]) {
      const items = buildUnitTypeNavigation({}, PROJECT_ID, currentHref)
      const areaHabitatsItem = items.find(
        (item) => item.text === 'Area habitats'
      )

      expect(areaHabitatsItem.children).toHaveLength(1)
      expect(areaHabitatsItem.children[0].text).toBe('Baseline')
    }
  })

  test('collapses Area habitats when viewing another section', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}] } },
      PROJECT_ID,
      HEDGEROWS_SUMMARY_HREF
    )
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')

    expect(areaHabitatsItem).toEqual({
      text: 'Area habitats',
      href: AREA_SUMMARY_HREF
    })
  })

  test('collapses every unit type on the project summary page', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}], watercourses: [{}] } },
      PROJECT_ID,
      PROJECT_SUMMARY_HREF
    )

    expect(items).toEqual([
      { text: 'Summary', current: true },
      { text: 'Area habitats', href: AREA_SUMMARY_HREF },
      { text: 'Hedgerows', href: HEDGEROWS_SUMMARY_HREF },
      { text: 'Watercourses', href: WATERCOURSES_SUMMARY_HREF }
    ])
  })
})

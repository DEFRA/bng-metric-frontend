import { buildUnitTypeNavigation } from './unit-type-navigation.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_SUMMARY_HREF = `/projects/${PROJECT_ID}/project-summary`
const AREA_SUMMARY_HREF = `/projects/${PROJECT_ID}/area-summary`
const AREA_BASELINE_HREF = `/projects/${PROJECT_ID}/area-baseline`
const HEDGEROWS_SUMMARY_HREF = `/projects/${PROJECT_ID}/hedgerows-summary`
const HEDGEROWS_BASELINE_HREF = `/projects/${PROJECT_ID}/hedgerows-baseline`
const WATERCOURSES_SUMMARY_HREF = `/projects/${PROJECT_ID}/watercourses-summary`
const WATERCOURSES_BASELINE_HREF = `/projects/${PROJECT_ID}/watercourses-baseline`

describe('buildUnitTypeNavigation', () => {
  test('always includes Summary and Area habitats', () => {
    const items = buildUnitTypeNavigation({}, PROJECT_ID, AREA_SUMMARY_HREF)

    expect(items).toEqual([
      { text: 'Summary', href: PROJECT_SUMMARY_HREF },
      {
        text: 'Area habitats',
        current: true,
        children: [
          {
            text: 'Baseline',
            href: AREA_BASELINE_HREF
          }
        ]
      }
    ])
  })

  test('includes Hedgerows as a collapsed link when the project has hedgerows', () => {
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

  test('includes Watercourses as a collapsed link when the project has watercourses', () => {
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

  test('expands only the current unit type with a Baseline child', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}], watercourses: [{}] } },
      PROJECT_ID,
      HEDGEROWS_SUMMARY_HREF
    )
    const hedgerowsItem = items.find((item) => item.text === 'Hedgerows')
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')
    const watercoursesItem = items.find((item) => item.text === 'Watercourses')

    expect(hedgerowsItem.current).toBe(true)
    expect(hedgerowsItem.href).toBeUndefined()
    expect(hedgerowsItem.children).toEqual([
      { text: 'Baseline', href: HEDGEROWS_BASELINE_HREF }
    ])
    expect(areaHabitatsItem).toEqual({
      text: 'Area habitats',
      href: AREA_SUMMARY_HREF
    })
    expect(watercoursesItem).toEqual({
      text: 'Watercourses',
      href: WATERCOURSES_SUMMARY_HREF
    })
  })

  test('marks only the matching Baseline child as current and collapses other unit types', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { hedgerows: [{}] } },
      PROJECT_ID,
      HEDGEROWS_BASELINE_HREF
    )
    const hedgerowsItem = items.find((item) => item.text === 'Hedgerows')
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')

    expect(hedgerowsItem.href).toBe(HEDGEROWS_SUMMARY_HREF)
    expect(hedgerowsItem.current).toBeUndefined()
    expect(hedgerowsItem.children).toEqual([
      { text: 'Baseline', current: true }
    ])
    expect(areaHabitatsItem).toEqual({
      text: 'Area habitats',
      href: AREA_SUMMARY_HREF
    })
  })

  test('marks the Watercourses Baseline child as current by href', () => {
    const items = buildUnitTypeNavigation(
      { baseline: { watercourses: [{}] } },
      PROJECT_ID,
      WATERCOURSES_BASELINE_HREF
    )
    const watercoursesItem = items.find((item) => item.text === 'Watercourses')
    const areaHabitatsItem = items.find((item) => item.text === 'Area habitats')

    expect(watercoursesItem.href).toBe(WATERCOURSES_SUMMARY_HREF)
    expect(watercoursesItem.children).toEqual([
      { text: 'Baseline', current: true }
    ])
    expect(areaHabitatsItem).toEqual({
      text: 'Area habitats',
      href: AREA_SUMMARY_HREF
    })
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

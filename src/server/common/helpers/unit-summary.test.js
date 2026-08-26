import {
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  percentageSummary
} from './unit-summary.js'

describe('formatUnits', () => {
  test.each([
    [1.234567890123456, '1.23'],
    [12345678901234.56, '12345678901234.60'],
    [-1.235, '-1.24'],
    [-0.004, '0.00'],
    [-0, '0.00'],
    [null, '0.00'],
    [Number.NaN, '0.00']
  ])('formats %s as %s', (value, expected) => {
    expect(formatUnits(value)).toBe(expected)
  })
})

describe('formatOptionalUnits', () => {
  test.each([
    [1.5, '1.50 units'],
    [0, '0.00 units'],
    [null, 'N/A'],
    [undefined, 'N/A'],
    [Number.NaN, 'N/A'],
    [Number.POSITIVE_INFINITY, 'N/A']
  ])('formats %s as %s', (value, expected) => {
    expect(formatOptionalUnits(value)).toBe(expected)
  })
})

describe('areaBaselineAction', () => {
  test('returns text-only action when no href is given', () => {
    expect(areaBaselineAction()).toEqual({
      text: 'View on-site area baseline'
    })
  })

  test('includes the href when one is given', () => {
    expect(areaBaselineAction('/projects/123/area-baseline')).toEqual({
      text: 'View on-site area baseline',
      href: '/projects/123/area-baseline'
    })
  })
})

describe('areaInterventionSummary', () => {
  test('maps area unit totals and net change fields', () => {
    expect(
      areaInterventionSummary({
        habitatsTotal: 12,
        treesTotal: 0.2,
        habitatsNetUnitChange: 2,
        habitatsNetUnitChangePercentage: 20
      })
    ).toEqual({
      units: 12.2,
      netUnitChange: 2,
      netPercentageChange: 20
    })
  })

  test('uses null for missing area totals so tiles can show N/A', () => {
    expect(areaInterventionSummary({})).toEqual({
      units: null,
      netUnitChange: undefined,
      netPercentageChange: undefined
    })
  })
})

describe('areaUnits', () => {
  test('sums habitats and trees totals', () => {
    expect(areaUnits({ habitatsTotal: 1.5, treesTotal: 0.5 })).toBe(2)
  })

  test('returns the default missing value when both totals are non-finite', () => {
    expect(areaUnits({})).toBe(0)
    expect(areaUnits({}, null)).toBeNull()
  })

  test('normalises a non-finite total to zero when the other is finite', () => {
    expect(areaUnits({ habitatsTotal: 'nope', treesTotal: 1 })).toBe(1)
  })
})

describe('percentageSummary', () => {
  test.each([
    [10, '10.00%', 'Met', 'govuk-tag--green'],
    [9.999, '10.00%', 'Met', 'govuk-tag--green'],
    [9.994, '9.99%', 'Not met', 'govuk-tag--red'],
    [-0.004, '0.00%', 'Not met', 'govuk-tag--red'],
    [-1, '-1.00%', 'Not met', 'govuk-tag--red']
  ])('maps %s to %s and %s', (value, netPercentageChange, text, classes) => {
    expect(percentageSummary(value)).toEqual({
      netPercentageChange,
      status: { text, classes }
    })
  })

  test.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'maps %s to N/A without a status',
    (value) => {
      expect(percentageSummary(value)).toEqual({
        netPercentageChange: 'N/A',
        status: null
      })
    }
  )
})

describe('buildUnitSummary', () => {
  test('shows a not-met, 100% loss when there is no post-intervention data', () => {
    const summary = buildUnitSummary({
      label: 'Area habitats',
      baselineUnits: 1.5,
      uploadHref: '/upload',
      intervention: null
    })

    expect(summary.id).toBe('area-habitats')
    expect(summary.netPercentageChange).toBe('-100.00%')
    expect(summary.status).toEqual({
      text: 'Not met',
      classes: 'govuk-tag--red'
    })
    expect(summary.baseline.units).toBe('1.50 units')
    expect(summary.postIntervention.units).toBe('0.00 units')
    expect(summary.postIntervention.action).toEqual({
      text: 'Upload on-site post intervention file',
      href: '/upload'
    })
    expect(summary.netUnitChange).toBe('-1.50 units')
  })

  test('shows post-intervention values and a view-only action when data is present', () => {
    const summary = buildUnitSummary({
      label: 'Area habitats',
      baselineUnits: 1.5,
      uploadHref: '/upload',
      intervention: {
        units: 2,
        netUnitChange: 0.5,
        netPercentageChange: 33.33
      }
    })

    expect(summary.postIntervention.heading).toBe('On-site post-intervention')
    expect(summary.postIntervention.units).toBe('2.00 units')
    expect(summary.postIntervention.action).toEqual({
      text: 'View on-site post intervention'
    })
    expect(summary.netUnitChange).toBe('0.50 units')
    expect(summary.netPercentageChange).toBe('33.33%')
  })

  test('passes through an optional headingHref for a linked title', () => {
    const linked = buildUnitSummary({
      label: 'Area habitats',
      baselineUnits: 1.5,
      uploadHref: '/upload',
      intervention: null,
      headingHref: '/projects/123/area-summary'
    })
    const unlinked = buildUnitSummary({
      label: 'Area habitats',
      baselineUnits: 1.5,
      uploadHref: '/upload',
      intervention: null
    })

    expect(linked.headingHref).toBe('/projects/123/area-summary')
    expect(unlinked.headingHref).toBeUndefined()
  })

  test('shows the post-intervention-only variant', () => {
    const summary = buildUnitSummary({
      label: 'Hedgerows',
      baselineUnits: 0,
      uploadHref: '/upload',
      intervention: {
        units: 1.98,
        netUnitChange: 1.98,
        netPercentageChange: null
      },
      postInterventionOnly: true
    })

    expect(summary.netPercentageChange).toBe('Not applicable')
    expect(summary.status).toBeNull()
    expect(summary.baseline.action).toBeNull()
    expect(summary.postIntervention.heading).toBe('On-site post intervention')
    expect(summary.postIntervention.units).toBe('1.98 units')
    expect(summary.postIntervention.action).toEqual({
      text: 'Upload on-site post intervention file',
      href: '/upload'
    })
    expect(summary.netUnitChange).toBe('1.98 units')
  })

  test('uses an optional baseline action in place of the default text', () => {
    const summary = buildUnitSummary({
      label: 'Area habitats',
      baselineUnits: 1.5,
      uploadHref: '/upload',
      intervention: null,
      baselineAction: {
        text: 'View on-site area baseline',
        href: '/area-baseline'
      }
    })

    expect(summary.baseline.action).toEqual({
      text: 'View on-site area baseline',
      href: '/area-baseline'
    })
  })
})

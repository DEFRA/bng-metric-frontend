import { describe, test, expect } from 'vitest'

import { buildAreaViewOnlyViewModel } from '../post-intervention-habitat-details/area-view-only-view-model.js'
import { renderTemplate } from '../test-helpers/render-template.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const feature = {
  ref: 'P-1',
  sizeSquareMetres: 25000,
  units: 2.5,
  retentionCategory: 'Retained',
  proposed: {
    broadType: 'Grassland',
    type: 'Modified grassland',
    condition: '6. Good',
    conditionScore: 3,
    distinctiveness: 'Low',
    distinctivenessScore: 2
  }
}

function render(overrides = {}) {
  return renderTemplate(
    'habitat-details/pi-habitat-details.njk',
    buildAreaViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId,
      ...overrides
    })
  )
}

// Template-level coverage for the BMD-608 figma design — the controller tests
// mock h.view, so only this proves the redesigned page actually renders.
describe('pi-habitat-details template (retained area, BMD-608 design)', () => {
  test('renders the parcel ref as the H1 with the project name as caption', () => {
    const html = render()

    expect(html).toMatch(/data-testid="app-heading-title">P-1</)
    expect(html).toMatch(/data-testid="app-heading-caption">Test Project</)
    // The fixed page name is the single section heading, not the H1.
    expect(html).toContain('Post-intervention habitat details')
    // The old summary-list Reference row is gone — the ref moved to the H1.
    expect(html).not.toContain('>Reference<')
  })

  test('renders every stacked row with the figma labels and values', () => {
    const html = render()

    for (const label of [
      'Intervention',
      'Size (hectares)',
      'Broad habitat',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Strategic significance'
    ]) {
      expect(html).toContain(`>${label}</h3>`)
    }
    expect(html).toContain('Retained')
    // Plain numeric size — the label names the unit, so no "ha" suffix.
    expect(html).toContain('>2.5</p>')
    expect(html).not.toContain('2.5ha')
    expect(html).toContain('Low (2)')
    expect(html).toContain('Good (3)')
    expect(html).toContain('Low (1)')
  })

  test('renders the bordered "Habitat units delivered" summary row', () => {
    const html = render()

    expect(html).toContain('app-units-delivered')
    expect(html).toContain('Habitat units delivered')
    expect(html).toContain('2.50')
    expect(html).not.toContain('Units in this habitat')
  })

  test('is read-only: no form controls anywhere on the page', () => {
    const html = render()

    expect(html).not.toContain('<select')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<form')
  })

  test('shows the "View baseline details" link only when a baseline feature matches', () => {
    const withLink = render()
    expect(withLink).toContain('View baseline details')
    expect(withLink).toContain(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&amp;projectId=${projectId}`
    )

    const withoutLink = render({ baselineFeatureId: null })
    expect(withoutLink).not.toContain('View baseline details')
  })
})

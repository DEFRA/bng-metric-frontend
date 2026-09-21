import { describe, expect, test } from 'vitest'

import { areaTradingRulesStatus } from './trading-rules-status.js'

const projectWith = (statuses) => ({
  postIntervention: { tradingRules: { areaHabitats: { statuses } } }
})

describe('areaTradingRulesStatus', () => {
  test('renders Met as a green tag', () => {
    expect(
      areaTradingRulesStatus(
        projectWith({ medium: 'Met', low: 'Met', overall: 'Met' })
      )
    ).toEqual({ text: 'Met', classes: 'govuk-tag--green' })
  })

  test('renders Not met as a red tag', () => {
    expect(
      areaTradingRulesStatus(
        projectWith({ medium: 'Not met', low: 'Met', overall: 'Not met' })
      )
    ).toEqual({ text: 'Not met', classes: 'govuk-tag--red' })
  })

  test('reads the site-wide status, not either band on its own', () => {
    // The Low band can pass while the site fails, because the figure it reads
    // ignores a Medium deficit that the site-wide status does not. Showing the
    // Low band here would tell a site it is compliant when it is not.
    const status = areaTradingRulesStatus(
      projectWith({ medium: 'Not met', low: 'Met', overall: 'Not met' })
    )

    expect(status.text).toBe('Not met')
  })

  test.each([
    ['no trading rules calculated', { postIntervention: {} }],
    [
      'no statuses on the trading rules',
      { postIntervention: { tradingRules: { areaHabitats: {} } } }
    ],
    [
      'an unrecognised status',
      {
        postIntervention: {
          tradingRules: { areaHabitats: { statuses: { overall: 'Unknown' } } }
        }
      }
    ],
    [
      'a null status',
      {
        postIntervention: {
          tradingRules: { areaHabitats: { statuses: { overall: null } } }
        }
      }
    ]
  ])('shows nothing for %s', (_label, project) => {
    // A post-intervention file was uploaded but the figures were never
    // calculated, so the answer is genuinely unknown. No tag, rather than a
    // red one claiming the site was assessed and fell short.
    expect(areaTradingRulesStatus(project)).toBeNull()
  })

  test.each([
    ['a baseline with no post-intervention upload', {}],
    ['no project at all', undefined]
  ])('reports Not met for %s', (_label, project) => {
    // Nothing has been delivered to trade against, so the rules cannot be met.
    // The engine and the site report both say the same for this case.
    expect(areaTradingRulesStatus(project)).toEqual({
      text: 'Not met',
      classes: 'govuk-tag--red'
    })
  })
})

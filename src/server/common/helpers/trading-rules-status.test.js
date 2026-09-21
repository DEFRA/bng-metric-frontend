import { describe, expect, test } from 'vitest'

import { areaTradingRulesStatus } from './trading-rules-status.js'

const projectWith = (statuses) => ({
  postIntervention: { tradingRules: { areaHabitats: { statuses } } }
})

describe('areaTradingRulesStatus', () => {
  test('renders Met as a green tag', () => {
    expect(
      areaTradingRulesStatus(
        projectWith({ medium: 'Met', low: 'Met', areaHabitats: 'Met' })
      )
    ).toEqual({ text: 'Met', classes: 'govuk-tag--green' })
  })

  test('renders Not met as a red tag', () => {
    expect(
      areaTradingRulesStatus(
        projectWith({ medium: 'Not met', low: 'Met', areaHabitats: 'Not met' })
      )
    ).toEqual({ text: 'Not met', classes: 'govuk-tag--red' })
  })

  test('reads the site-wide status, not either band on its own', () => {
    // The Low band can pass while the site fails, because the figure it reads
    // ignores a Medium deficit that the site-wide status does not. Showing the
    // Low band here would tell a site it is compliant when it is not.
    const status = areaTradingRulesStatus(
      projectWith({ medium: 'Not met', low: 'Met', areaHabitats: 'Not met' })
    )

    expect(status.text).toBe('Not met')
  })

  test.each([
    ['no project', undefined],
    ['no post-intervention upload', {}],
    ['no trading rules calculated', { postIntervention: {} }],
    [
      'no statuses on the trading rules',
      { postIntervention: { tradingRules: { areaHabitats: {} } } }
    ],
    [
      'an unrecognised status',
      {
        postIntervention: {
          tradingRules: {
            areaHabitats: { statuses: { areaHabitats: 'Unknown' } }
          }
        }
      }
    ],
    [
      'a null status',
      {
        postIntervention: {
          tradingRules: { areaHabitats: { statuses: { areaHabitats: null } } }
        }
      }
    ]
  ])('shows nothing for %s', (_label, project) => {
    expect(areaTradingRulesStatus(project)).toBeNull()
  })
})

import { describe, expect, test } from 'vitest'

import { areaTradingRulesStatus } from './trading-rules-status.js'

const projectWith = (areaHabitats) => ({
  tradingRuleStatuses: { areaHabitats }
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

  test('reads the site-wide verdict, not either band on its own', () => {
    // The Low band can pass while the site fails, because the figure it reads
    // ignores a Medium deficit the statutory metric nets off. Showing the Low
    // band here would tell a site it is compliant when it is not.
    const status = areaTradingRulesStatus(
      projectWith({ medium: 'Not met', low: 'Met', overall: 'Not met' })
    )

    expect(status.text).toBe('Not met')
  })

  test.each([
    ['no project', undefined],
    ['no statuses on the response', {}],
    ['no area-habitat statuses', { tradingRuleStatuses: {} }],
    ['a null verdict', projectWith({ medium: null, low: null, overall: null })],
    ['an unrecognised verdict', projectWith({ overall: 'Probably' })]
  ])('shows nothing for %s', (_label, project) => {
    // The backend returns nulls only where a post-intervention file was
    // uploaded without its figures being calculated. Unknown is not failed, so
    // no tag, rather than a red one claiming the site was assessed.
    expect(areaTradingRulesStatus(project)).toBeNull()
  })

  test('leaves the Not met for an un-uploaded project to the backend', () => {
    // A baseline with no post-intervention file is Not met — nothing has been
    // delivered to trade against — but that verdict is reached in the engine,
    // not restated here. Here it is just another Not met.
    expect(
      areaTradingRulesStatus(
        projectWith({ medium: null, low: null, overall: 'Not met' })
      )
    ).toEqual({ text: 'Not met', classes: 'govuk-tag--red' })
  })
})

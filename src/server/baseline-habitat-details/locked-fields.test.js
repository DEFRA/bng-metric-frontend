import { lockedFieldDisplays } from './locked-fields.js'
import {
  buildConditionItems,
  buildSelectItems
} from './strategies/select-items.js'

describe('lockedFieldDisplays', () => {
  it('shows each dropdown’s chosen option as the dropdown would', () => {
    const displays = lockedFieldDisplays({
      broadHabitatOptions: buildSelectItems(
        ['Grassland', 'Woodland'],
        'Grassland',
        'Choose broad habitat'
      ),
      habitatTypeOptions: buildSelectItems(
        ['Modified grassland'],
        'Modified grassland',
        'Choose habitat type'
      ),
      conditionOptions: buildConditionItems(
        [
          { condition: 'Good', score: 3 },
          { condition: 'Poor', score: 1 }
        ],
        'Poor'
      ),
      watercourseEncroachmentOptions: buildSelectItems(
        ['No Encroachment', 'Minor'],
        'Minor',
        'Choose'
      ),
      riparianEncroachmentOptions: buildSelectItems(
        ['Major/Major'],
        'Major/Major',
        'Choose'
      )
    })

    expect(displays).toEqual({
      broadHabitatDisplay: 'Grassland',
      habitatTypeDisplay: 'Modified grassland',
      conditionDisplay: 'Poor (1)',
      watercourseEncroachmentDisplay: 'Minor',
      riparianEncroachmentDisplay: 'Major/Major'
    })
  })

  it('keeps a saved value the reference data no longer offers', () => {
    const { habitatTypeDisplay } = lockedFieldDisplays({
      habitatTypeOptions: buildSelectItems(
        ['Modified grassland'],
        'Retired type',
        'Choose habitat type'
      )
    })

    expect(habitatTypeDisplay).toBe('Retired type')
  })

  it('gives an empty value, not the blank choice’s text, when nothing is chosen', () => {
    const { conditionDisplay } = lockedFieldDisplays({
      conditionOptions: buildConditionItems(
        [{ condition: 'Good', score: 3 }],
        null
      )
    })

    expect(conditionDisplay).toBe('')
  })

  it('gives an empty value for a dropdown the page does not build', () => {
    const { broadHabitatDisplay, riparianEncroachmentDisplay } =
      lockedFieldDisplays({})

    expect(broadHabitatDisplay).toBe('')
    expect(riparianEncroachmentDisplay).toBe('')
  })
})

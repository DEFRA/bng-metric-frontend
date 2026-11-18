import { wreck } from '../common/helpers/wreck-client.js'
import {
  createMockH,
  featureId,
  mockFeature,
  projectId
} from './controller-test-helpers.js'
import { createdHedgerowFeature } from './created-hedgerow-test-fixtures.js'
import { createdWatercourseFeature } from './created-watercourse-test-fixtures.js'
import { _resetCreatedAreaReferenceCache } from './created-area-edit.js'
import { getController, postController } from './controller.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

describe.each([
  ['hedgerow', createdHedgerowFeature],
  ['watercourse', createdWatercourseFeature]
])('incomplete Created %s', (type, feature) => {
  beforeEach(() => _resetCreatedAreaReferenceCache())

  // PO ruling (BMD-1046 testing): a condition with no habitat type to offer
  // it under is not shown or kept. It shows the default option and a rename
  // clears it.
  test.each([null, undefined, ''])(
    'shows no condition and a rename clears it, with missing type %s',
    async (habitatType) => {
      const stored = {
        ...structuredClone(feature),
        units: null,
        status: 'Incomplete',
        proposed: { ...feature.proposed, type: habitatType, condition: 'Good' }
      }
      mockFeature({ type, feature: stored })
      vi.mocked(wreck.put).mockResolvedValue({
        res: { statusCode: 200 },
        payload: {}
      })
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)
      const vm = h.view.mock.calls[0][1]
      expect(vm.values.habitatType).toBe('')
      expect(vm.values.condition).toBe('')
      expect(vm.fields.condition.items).toEqual([
        expect.objectContaining({ value: '', selected: true })
      ])
      expect(JSON.stringify(vm.fields)).not.toContain('imported value')
      const { broadHabitat: _broad, ...values } = vm.values
      await postController.handler(
        { payload: { projectId, featureId, ...values, ref: 'Renamed' } },
        h
      )
      expect(h.redirect).toHaveBeenCalled()
      const saved = JSON.parse(wreck.put.mock.calls[0][1].payload)
      expect(saved).toMatchObject({
        ref: 'Renamed',
        habitatType: null,
        condition: null
      })
    }
  )
})

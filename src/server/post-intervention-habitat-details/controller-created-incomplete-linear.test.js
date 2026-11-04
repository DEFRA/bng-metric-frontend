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

  test.each([null, undefined, ''])(
    'keeps a saved condition through rename and reload with type %s',
    async (habitatType) => {
      const stored = {
        ...structuredClone(feature),
        units: null,
        status: 'Incomplete',
        proposed: { ...feature.proposed, type: habitatType, condition: 'Good' }
      }
      mockFeature({ type, feature: stored })
      // Model the existing backend omission contract: only supplied condition changes it.
      vi.mocked(wreck.put).mockImplementation(async (_url, { payload }) => {
        const saved = JSON.parse(payload)
        stored.ref = saved.ref
        stored.proposed.type = saved.habitatType
        if (Object.hasOwn(saved, 'condition')) {
          stored.proposed.condition = saved.condition
        }
        return { res: { statusCode: 200 }, payload: {} }
      })
      const h = createMockH()
      const get = () =>
        getController.handler({ query: { projectId, featureId } }, h)
      await get()
      const vm = h.view.mock.calls[0][1]
      expect(vm.values.habitatType).toBe('')
      expect(vm.values.condition).toBe('unchanged')
      expect(vm.fields.condition.items).toContainEqual(
        expect.objectContaining({
          value: 'unchanged',
          text: 'Good (imported value)',
          selected: true
        })
      )
      const { broadHabitat: _broad, ...values } = vm.values
      await postController.handler(
        { payload: { projectId, featureId, ...values, ref: 'Renamed' } },
        h
      )
      expect(h.redirect).toHaveBeenCalled()
      const saved = JSON.parse(wreck.put.mock.calls[0][1].payload)
      expect(saved).toMatchObject({
        ref: 'Renamed',
        habitatType: habitatType ?? null
      })
      expect(saved).not.toHaveProperty('condition')
      await get()
      expect(h.view.mock.calls.at(-1)[1].values).toMatchObject({
        ref: 'Renamed',
        habitatType: '',
        condition: 'unchanged'
      })
      expect(stored.proposed.condition).toBe('Good')

      await postController.handler(
        {
          payload: {
            projectId,
            featureId,
            ...values,
            ref: 'Renamed',
            condition: ''
          }
        },
        h
      )
      expect(
        JSON.parse(wreck.put.mock.calls[1][1].payload).condition
      ).toBeNull()
      await get()
      expect(h.view.mock.calls.at(-1)[1].values.condition).toBe('')
      expect(stored.proposed.condition).toBeNull()
    }
  )
})

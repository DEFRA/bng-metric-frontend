import { wreck } from '../helpers/wreck-client.js'
import { fetchProject } from './projects.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const mockPayload = { project: { name: 'Test Project' } }

describe('fetchProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns the payload on success', async () => {
    vi.mocked(wreck.get).mockResolvedValue({ payload: mockPayload })

    const result = await fetchProject(projectId)

    expect(result).toEqual(mockPayload)
  })

  test('returns null when payload is null', async () => {
    vi.mocked(wreck.get).mockResolvedValue({ payload: null })

    const result = await fetchProject(projectId)

    expect(result).toBeNull()
  })

  test('returns null when the request throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network error'))

    const result = await fetchProject(projectId)

    expect(result).toBeNull()
  })
})

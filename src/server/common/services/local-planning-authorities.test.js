vi.mock('../helpers/wreck-client.js', () => ({ wreck: { get: vi.fn() } }))

let wreck
let fetchLocalPlanningAuthorities

beforeEach(async () => {
  vi.resetModules()
  const wreckModule = await import('../helpers/wreck-client.js')
  const authoritiesModule = await import('./local-planning-authorities.js')
  wreck = wreckModule.wreck
  fetchLocalPlanningAuthorities =
    authoritiesModule.fetchLocalPlanningAuthorities
})

test('fetches the local backend lookup', async () => {
  const payload = [{ name: 'Adur LPA', reference: 'E60000296' }]
  vi.mocked(wreck.get).mockResolvedValue({ res: { statusCode: 200 }, payload })
  expect(await fetchLocalPlanningAuthorities()).toEqual(payload)
  expect(wreck.get).toHaveBeenCalledWith(
    expect.stringContaining('/reference/local-planning-authorities')
  )
})

test.each([null, {}, [], [{ name: 'Missing reference' }], [null]])(
  'fails closed for an invalid lookup: %j',
  async (payload) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload
    })
    await expect(fetchLocalPlanningAuthorities()).rejects.toMatchObject({
      output: { statusCode: 502 }
    })
  }
)

test('reports a lookup outage', async () => {
  vi.mocked(wreck.get).mockRejectedValue(new Error('Network failure'))
  await expect(fetchLocalPlanningAuthorities()).rejects.toMatchObject({
    output: { statusCode: 502 }
  })
})

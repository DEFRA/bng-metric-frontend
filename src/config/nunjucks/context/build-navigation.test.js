import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Projects',
        href: '/project-dashboard'
      }
    ])
  })

  test('Should highlight Projects for /projects path', () => {
    const nav = buildNavigation(mockRequest({ path: '/project-dashboard' }))
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/project-dashboard'
    })
  })

  test('Should highlight Projects for /project-dashboard/{id} path', () => {
    const nav = buildNavigation(
      mockRequest({ path: '/project-dashboard/some-uuid' })
    )
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/project-dashboard'
    })
  })
})

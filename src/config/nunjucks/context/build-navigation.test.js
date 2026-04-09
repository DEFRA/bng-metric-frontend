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
        href: '/projects'
      }
    ])
  })

  test('Should highlight Projects for /projects path', () => {
    const nav = buildNavigation(mockRequest({ path: '/projects' }))
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/projects'
    })
  })

  test('Should highlight Projects for /projects/{id} path', () => {
    const nav = buildNavigation(mockRequest({ path: '/projects/some-uuid' }))
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/projects'
    })
  })
})

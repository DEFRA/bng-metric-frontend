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
        href: '/manage-projects'
      }
    ])
  })

  test('Should highlight Projects for /projects path', () => {
    const nav = buildNavigation(mockRequest({ path: '/manage-projects' }))
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/manage-projects'
    })
  })

  test('Should highlight Projects for /manage-projects/{id} path', () => {
    const nav = buildNavigation(
      mockRequest({ path: '/manage-projects/some-uuid' })
    )
    expect(nav[0]).toEqual({
      current: true,
      text: 'Projects',
      href: '/manage-projects'
    })
  })
})

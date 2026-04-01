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
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'Projects',
        href: '/projects'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'Projects',
        href: '/projects'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should highlight Projects for /projects path', () => {
    const nav = buildNavigation(mockRequest({ path: '/projects' }))
    expect(nav[1]).toEqual({
      current: true,
      text: 'Projects',
      href: '/projects'
    })
  })

  test('Should highlight Projects for /projects/{id} path', () => {
    const nav = buildNavigation(mockRequest({ path: '/projects/some-uuid' }))
    expect(nav[1]).toEqual({
      current: true,
      text: 'Projects',
      href: '/projects'
    })
  })
})

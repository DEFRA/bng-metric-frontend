export function buildNavigation(request) {
  return [
    {
      text: 'Projects',
      href: '/projects',
      current: request?.path?.startsWith('/projects')
    }
  ]
}

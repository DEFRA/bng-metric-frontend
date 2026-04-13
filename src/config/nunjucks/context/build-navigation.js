export function buildNavigation(request) {
  return [
    {
      text: 'Projects',
      href: '/project-dashboard',
      current: request?.path?.startsWith('/project-dashboard')
    }
  ]
}

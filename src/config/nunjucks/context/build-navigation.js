export function buildNavigation(request) {
  return [
    {
      text: 'Projects',
      href: '/manage-projects',
      current: request?.path?.startsWith('/manage-projects')
    }
  ]
}

export function buildNavigation(request) {
  return [
    // {
    //   text: 'Home',
    //   href: '/',
    //   current: request?.path === '/'
    // },
    {
      text: 'Projects',
      href: '/projects',
      current: request?.path?.startsWith('/projects')
    }
    // {
    //   text: 'About',
    //   href: '/about',
    //   current: request?.path === '/about'
    // }
  ]
}

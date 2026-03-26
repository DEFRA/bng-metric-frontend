import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

export const dbInfoController = {
  async handler(_request, h) {
    const response = await fetch(`${backendUrl}/db-info`)
    const data = await response.json()

    return h.view('db-info/index', {
      pageTitle: 'DB Info',
      heading: 'Database Info',
      dbInfo: JSON.stringify(data, null, 2)
    })
  }
}
